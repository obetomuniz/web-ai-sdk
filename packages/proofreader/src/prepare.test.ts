import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearSessionCacheForTests,
  configureProofreaderCache,
} from "./api.js";
import {
  clearProofreaderSessions,
  ProofreaderUnavailableError,
  prepareProofreader,
  proofread,
} from "./index.js";

interface FakeProofreader {
  proofread: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const makeInstance = (): FakeProofreader => ({
  proofread: vi.fn(async () => ({
    correctedInput: "Fixed.",
    corrections: [],
  })),
  destroy: vi.fn(),
});

const installFakeApi = () => {
  const instances: FakeProofreader[] = [];
  const api = {
    availability: vi.fn(async () => "available" as const),
    create: vi.fn(async () => {
      const instance = makeInstance();
      instances.push(instance);
      return instance;
    }),
  };
  (globalThis as { Proofreader?: unknown }).Proofreader = api;
  return { api, instances };
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  (globalThis as { Proofreader?: unknown }).Proofreader = undefined;
});

describe("prepareProofreader", () => {
  it("starts creation immediately and the matching proofread reuses it", async () => {
    const { api } = installFakeApi();
    const lease = prepareProofreader({ expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(1);
    await lease.ready;

    const result = await proofread({
      input: "I has cat.",
      expectedInputLanguages: ["en"],
    });
    expect(result.output?.correctedInput).toBe("Fixed.");
    expect(api.create).toHaveBeenCalledTimes(1);
    lease.release();
  });

  it("never throws when the API is missing; ready rejects instead", async () => {
    const lease = prepareProofreader({ expectedInputLanguages: ["en"] });
    await expect(lease.ready).rejects.toBeInstanceOf(
      ProofreaderUnavailableError,
    );
    expect(() => lease.release()).not.toThrow();
  });

  it("shares one session between concurrent leases and destroys exactly once", async () => {
    const { api, instances } = installFakeApi();
    const first = prepareProofreader({ expectedInputLanguages: ["en"] });
    const second = prepareProofreader({ expectedInputLanguages: ["en"] });
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
    let resolveCreate: (instance: FakeProofreader) => void = () => {};
    const instance = makeInstance();
    api.create.mockImplementationOnce(
      () =>
        new Promise<FakeProofreader>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const lease = prepareProofreader({ expectedInputLanguages: ["en"] });
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveCreate(instance);
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);

    // The released entry left the cache, so preparing again creates anew.
    const retry = prepareProofreader({ expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(2);
    await retry.ready;
    retry.release();
  });

  it("creation failure rejects ready, evicts the entry, and allows retry", async () => {
    const { api } = installFakeApi();
    api.create.mockRejectedValueOnce(new Error("no space"));

    const failed = prepareProofreader({ expectedInputLanguages: ["en"] });
    await expect(failed.ready).rejects.toBeInstanceOf(
      ProofreaderUnavailableError,
    );
    failed.release();

    const retry = prepareProofreader({ expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(2);
    await expect(retry.ready).resolves.toBeUndefined();
    retry.release();
  });

  it("defers destruction while inference is in flight", async () => {
    const { instances } = installFakeApi();
    const lease = prepareProofreader({ expectedInputLanguages: ["en"] });
    await lease.ready;

    const instance = instances[0];
    if (!instance) throw new Error("expected a created instance");
    let resolveProofread: (output: {
      correctedInput: string;
      corrections: never[];
    }) => void = () => {};
    instance.proofread.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProofread = resolve;
        }),
    );

    const running = proofread({
      input: "I has cat.",
      expectedInputLanguages: ["en"],
    });
    await tick();
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveProofread({ correctedInput: "Fixed.", corrections: [] });
    await expect(running).resolves.toEqual({
      output: { correctedInput: "Fixed.", corrections: [] },
      cached: false,
    });
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });

  it("pins leased entries against LRU eviction", async () => {
    const { instances } = installFakeApi();
    configureProofreaderCache({ max: 1 });

    const lease = prepareProofreader({ expectedInputLanguages: ["en"] });
    await lease.ready;
    await proofread({ input: "Tengo gato.", expectedInputLanguages: ["es"] });
    await tick();

    // Inserting a third entry trims to max; the leased "en" session survives
    // and the unpinned "es" session is evicted.
    const third = prepareProofreader({ expectedInputLanguages: ["ja"] });
    await third.ready;
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();
    expect(instances[1]?.destroy).toHaveBeenCalledTimes(1);

    lease.release();
    third.release();
  });

  it("isolates leases per option key", async () => {
    const { api, instances } = installFakeApi();
    const english = prepareProofreader({ expectedInputLanguages: ["en"] });
    await english.ready;

    await proofread({ input: "Tengo gato.", expectedInputLanguages: ["es"] });
    expect(api.create).toHaveBeenCalledTimes(2);

    english.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(instances[1]?.destroy).not.toHaveBeenCalled();

    // The other configuration stays cached and reusable.
    await proofread({ input: "Tengo gato.", expectedInputLanguages: ["es"] });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("clear detaches leased sessions and destroys them on final release", async () => {
    const { api, instances } = installFakeApi();
    const lease = prepareProofreader({ expectedInputLanguages: ["en"] });
    await lease.ready;

    clearProofreaderSessions();
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();

    // The detached session no longer serves new calls.
    await proofread({ input: "I has cat.", expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(2);

    lease.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("re-trims the cache when the last in-flight pin drops", async () => {
    const { api, instances } = installFakeApi();
    configureProofreaderCache({ max: 0 });

    await proofread({ input: "Tengo gato.", expectedInputLanguages: ["es"] });
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);

    // Nothing stayed cached, so the same call creates a fresh session.
    await proofread({ input: "Tengo gato.", expectedInputLanguages: ["es"] });
    expect(api.create).toHaveBeenCalledTimes(2);
  });
});
