import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearSessionCacheForTests,
  configureSummarizerCache,
} from "./api.js";
import {
  clearSummarizerSessions,
  prepareSummarizer,
  SummarizerUnavailableError,
  summarize,
} from "./index.js";

interface FakeSummarizer {
  summarize: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const makeInstance = (): FakeSummarizer => ({
  summarize: vi.fn(async () => "TLDR."),
  destroy: vi.fn(),
});

const installFakeApi = () => {
  const instances: FakeSummarizer[] = [];
  const api = {
    availability: vi.fn(async () => "available" as const),
    create: vi.fn(async () => {
      const instance = makeInstance();
      instances.push(instance);
      return instance;
    }),
  };
  (globalThis as { Summarizer?: unknown }).Summarizer = api;
  return { api, instances };
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  (globalThis as { Summarizer?: unknown }).Summarizer = undefined;
});

describe("prepareSummarizer", () => {
  it("starts creation immediately and the matching summarize reuses it", async () => {
    const { api } = installFakeApi();
    const lease = prepareSummarizer({ language: "en" });
    expect(api.create).toHaveBeenCalledTimes(1);
    await lease.ready;

    const result = await summarize({ language: "en", input: "Long text." });
    expect(result.output).toBe("TLDR.");
    expect(api.create).toHaveBeenCalledTimes(1);
    lease.release();
  });

  it("never throws when the API is missing; ready rejects instead", async () => {
    const lease = prepareSummarizer({ language: "en" });
    await expect(lease.ready).rejects.toBeInstanceOf(
      SummarizerUnavailableError,
    );
    expect(() => lease.release()).not.toThrow();
  });

  it("shares one session between concurrent leases and destroys exactly once", async () => {
    const { api, instances } = installFakeApi();
    const first = prepareSummarizer({ language: "en" });
    const second = prepareSummarizer({ language: "en" });
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
    let resolveCreate: (instance: FakeSummarizer) => void = () => {};
    const instance = makeInstance();
    api.create.mockImplementationOnce(
      () =>
        new Promise<FakeSummarizer>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const lease = prepareSummarizer({ language: "en" });
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveCreate(instance);
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);

    // The released entry left the cache, so preparing again creates anew.
    const retry = prepareSummarizer({ language: "en" });
    expect(api.create).toHaveBeenCalledTimes(2);
    await retry.ready;
    retry.release();
  });

  it("creation failure rejects ready, evicts the entry, and allows retry", async () => {
    const { api } = installFakeApi();
    api.create.mockRejectedValueOnce(new Error("no space"));

    const failed = prepareSummarizer({ language: "en" });
    await expect(failed.ready).rejects.toBeInstanceOf(
      SummarizerUnavailableError,
    );
    failed.release();

    const retry = prepareSummarizer({ language: "en" });
    expect(api.create).toHaveBeenCalledTimes(2);
    await expect(retry.ready).resolves.toBeUndefined();
    retry.release();
  });

  it("defers destruction while inference is in flight", async () => {
    const { instances } = installFakeApi();
    const lease = prepareSummarizer({ language: "en" });
    await lease.ready;

    const instance = instances[0];
    if (!instance) throw new Error("expected a created instance");
    let resolveSummarize: (text: string) => void = () => {};
    instance.summarize.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveSummarize = resolve;
        }),
    );

    const running = summarize({ language: "en", input: "Long text." });
    await tick();
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveSummarize("TLDR.");
    await expect(running).resolves.toEqual({ output: "TLDR.", cached: false });
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });

  it("pins leased entries against LRU eviction", async () => {
    const { instances } = installFakeApi();
    configureSummarizerCache({ max: 1 });

    const lease = prepareSummarizer({ language: "en" });
    await lease.ready;
    await summarize({ language: "es", input: "Texto largo." });
    await tick();

    // Inserting a third entry trims to max; the leased "en" session survives
    // and the unpinned "es" session is evicted.
    const third = prepareSummarizer({ language: "ja" });
    await third.ready;
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();
    expect(instances[1]?.destroy).toHaveBeenCalledTimes(1);

    lease.release();
    third.release();
  });

  it("isolates leases per option key", async () => {
    const { api, instances } = installFakeApi();
    const english = prepareSummarizer({ language: "en" });
    await english.ready;

    await summarize({ language: "es", input: "Texto largo." });
    expect(api.create).toHaveBeenCalledTimes(2);

    english.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(instances[1]?.destroy).not.toHaveBeenCalled();

    // The other configuration stays cached and reusable.
    await summarize({ language: "es", input: "Texto largo." });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("clear detaches leased sessions and destroys them on final release", async () => {
    const { api, instances } = installFakeApi();
    const lease = prepareSummarizer({ language: "en" });
    await lease.ready;

    clearSummarizerSessions();
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();

    // The detached session no longer serves new calls.
    await summarize({ language: "en", input: "Long text." });
    expect(api.create).toHaveBeenCalledTimes(2);

    lease.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
  });
});
