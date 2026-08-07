import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests, configureWriterCache } from "./api.js";
import {
  clearWriterSessions,
  prepareWriter,
  WriterUnavailableError,
  write,
} from "./index.js";

interface FakeWriter {
  write: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const makeInstance = (): FakeWriter => ({
  write: vi.fn(async () => "Generated."),
  destroy: vi.fn(),
});

const installFakeApi = () => {
  const instances: FakeWriter[] = [];
  const api = {
    availability: vi.fn(async () => "available" as const),
    create: vi.fn(async () => {
      const instance = makeInstance();
      instances.push(instance);
      return instance;
    }),
  };
  (globalThis as { Writer?: unknown }).Writer = api;
  return { api, instances };
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  (globalThis as { Writer?: unknown }).Writer = undefined;
});

describe("prepareWriter", () => {
  it("starts creation immediately and the matching write reuses it", async () => {
    const { api } = installFakeApi();
    const lease = prepareWriter({ tone: "casual" });
    expect(api.create).toHaveBeenCalledTimes(1);
    await lease.ready;

    const result = await write({ tone: "casual", input: "Draft an email." });
    expect(result.output).toBe("Generated.");
    expect(api.create).toHaveBeenCalledTimes(1);
    lease.release();
  });

  it("never throws when the API is missing; ready rejects instead", async () => {
    const lease = prepareWriter({});
    await expect(lease.ready).rejects.toBeInstanceOf(WriterUnavailableError);
    expect(() => lease.release()).not.toThrow();
  });

  it("shares one session between concurrent leases and destroys exactly once", async () => {
    const { api, instances } = installFakeApi();
    const first = prepareWriter({});
    const second = prepareWriter({});
    expect(api.create).toHaveBeenCalledTimes(1);
    await Promise.all([first.ready, second.ready]);

    first.release();
    first.release();
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();

    second.release();
    second.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("release before creation settles destroys the session once created", async () => {
    const { api } = installFakeApi();
    let resolveCreate: (instance: FakeWriter) => void = () => {};
    const instance = makeInstance();
    api.create.mockImplementationOnce(
      () =>
        new Promise<FakeWriter>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const lease = prepareWriter({});
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveCreate(instance);
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);

    // The released entry left the cache, so preparing again creates anew.
    const retry = prepareWriter({});
    expect(api.create).toHaveBeenCalledTimes(2);
    await retry.ready;
    retry.release();
  });

  it("creation failure rejects ready, evicts the entry, and allows retry", async () => {
    const { api } = installFakeApi();
    api.create.mockRejectedValueOnce(new Error("no space"));

    const failed = prepareWriter({});
    await expect(failed.ready).rejects.toBeInstanceOf(WriterUnavailableError);
    failed.release();

    const retry = prepareWriter({});
    expect(api.create).toHaveBeenCalledTimes(2);
    await expect(retry.ready).resolves.toBeUndefined();
    retry.release();
  });

  it("defers destruction while inference is in flight", async () => {
    const { instances } = installFakeApi();
    const lease = prepareWriter({});
    await lease.ready;

    const instance = instances[0];
    if (!instance) throw new Error("expected a created instance");
    let resolveWrite: (text: string) => void = () => {};
    instance.write.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveWrite = resolve;
        }),
    );

    const running = write({ input: "Draft an email." });
    await tick();
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveWrite("Generated.");
    await expect(running).resolves.toEqual({
      output: "Generated.",
      cached: false,
    });
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });

  it("pins leased entries against LRU eviction", async () => {
    const { instances } = installFakeApi();
    configureWriterCache({ max: 1 });

    const lease = prepareWriter({ tone: "formal" });
    await lease.ready;
    await write({ tone: "neutral", input: "Draft an email." });
    await tick();

    // Inserting a third entry trims to max; the leased "formal" session
    // survives and the unpinned "neutral" session is evicted.
    const third = prepareWriter({ tone: "casual" });
    await third.ready;
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();
    expect(instances[1]?.destroy).toHaveBeenCalledTimes(1);

    lease.release();
    third.release();
  });

  it("isolates leases per option key", async () => {
    const { api, instances } = installFakeApi();
    const formal = prepareWriter({ tone: "formal" });
    await formal.ready;

    await write({ tone: "casual", input: "Draft an email." });
    expect(api.create).toHaveBeenCalledTimes(2);

    formal.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(instances[1]?.destroy).not.toHaveBeenCalled();

    // The other configuration stays cached and reusable.
    await write({ tone: "casual", input: "Draft an email." });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("clear detaches leased sessions and destroys them on final release", async () => {
    const { api, instances } = installFakeApi();
    const lease = prepareWriter({});
    await lease.ready;

    clearWriterSessions();
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();

    // The detached session no longer serves new calls.
    await write({ input: "Draft an email." });
    expect(api.create).toHaveBeenCalledTimes(2);

    lease.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("re-trims the cache when the last in-flight pin drops", async () => {
    const { api, instances } = installFakeApi();
    configureWriterCache({ max: 0 });

    await write({ tone: "casual", input: "Draft an email." });
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);

    // Nothing stayed cached, so the same call creates a fresh session.
    await write({ tone: "casual", input: "Draft an email." });
    expect(api.create).toHaveBeenCalledTimes(2);
  });
});
