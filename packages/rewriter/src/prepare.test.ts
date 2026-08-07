import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests, configureRewriterCache } from "./api.js";
import {
  clearRewriterSessions,
  prepareRewriter,
  RewriterUnavailableError,
  rewrite,
} from "./index.js";

interface FakeRewriter {
  rewrite: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const makeInstance = (): FakeRewriter => ({
  rewrite: vi.fn(async () => "Rewritten."),
  destroy: vi.fn(),
});

const installFakeApi = () => {
  const instances: FakeRewriter[] = [];
  const api = {
    availability: vi.fn(async () => "available" as const),
    create: vi.fn(async () => {
      const instance = makeInstance();
      instances.push(instance);
      return instance;
    }),
  };
  (globalThis as { Rewriter?: unknown }).Rewriter = api;
  return { api, instances };
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  (globalThis as { Rewriter?: unknown }).Rewriter = undefined;
});

describe("prepareRewriter", () => {
  it("starts creation immediately and the matching rewrite reuses it", async () => {
    const { api } = installFakeApi();
    const lease = prepareRewriter();
    expect(api.create).toHaveBeenCalledTimes(1);
    await lease.ready;

    const result = await rewrite({ input: "Make this clearer." });
    expect(result.output).toBe("Rewritten.");
    expect(api.create).toHaveBeenCalledTimes(1);
    lease.release();
  });

  it("never throws when the API is missing; ready rejects instead", async () => {
    const lease = prepareRewriter();
    await expect(lease.ready).rejects.toBeInstanceOf(RewriterUnavailableError);
    expect(() => lease.release()).not.toThrow();
  });

  it("shares one session between concurrent leases and destroys exactly once", async () => {
    const { api, instances } = installFakeApi();
    const first = prepareRewriter();
    const second = prepareRewriter();
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
    let resolveCreate: (instance: FakeRewriter) => void = () => {};
    const instance = makeInstance();
    api.create.mockImplementationOnce(
      () =>
        new Promise<FakeRewriter>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const lease = prepareRewriter();
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveCreate(instance);
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);

    // The released entry left the cache, so preparing again creates anew.
    const retry = prepareRewriter();
    expect(api.create).toHaveBeenCalledTimes(2);
    await retry.ready;
    retry.release();
  });

  it("creation failure rejects ready, evicts the entry, and allows retry", async () => {
    const { api } = installFakeApi();
    api.create.mockRejectedValueOnce(new Error("no space"));

    const failed = prepareRewriter();
    await expect(failed.ready).rejects.toBeInstanceOf(RewriterUnavailableError);
    failed.release();

    const retry = prepareRewriter();
    expect(api.create).toHaveBeenCalledTimes(2);
    await expect(retry.ready).resolves.toBeUndefined();
    retry.release();
  });

  it("defers destruction while inference is in flight", async () => {
    const { instances } = installFakeApi();
    const lease = prepareRewriter();
    await lease.ready;

    const instance = instances[0];
    if (!instance) throw new Error("expected a created instance");
    let resolveRewrite: (text: string) => void = () => {};
    instance.rewrite.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveRewrite = resolve;
        }),
    );

    const running = rewrite({ input: "Make this clearer." });
    await tick();
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveRewrite("Rewritten.");
    await expect(running).resolves.toEqual({
      output: "Rewritten.",
      cached: false,
    });
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });

  it("pins leased entries against LRU eviction", async () => {
    const { instances } = installFakeApi();
    configureRewriterCache({ max: 1 });

    const lease = prepareRewriter({ tone: "more-formal" });
    await lease.ready;
    await rewrite({ input: "Loosen this up.", tone: "more-casual" });
    await tick();

    // Inserting a third entry trims to max; the leased "more-formal" session
    // survives and the unpinned "more-casual" session is evicted.
    const third = prepareRewriter({ length: "shorter" });
    await third.ready;
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();
    expect(instances[1]?.destroy).toHaveBeenCalledTimes(1);

    lease.release();
    third.release();
  });

  it("isolates leases per option key", async () => {
    const { api, instances } = installFakeApi();
    const formal = prepareRewriter({ tone: "more-formal" });
    await formal.ready;

    await rewrite({ input: "Loosen this up.", tone: "more-casual" });
    expect(api.create).toHaveBeenCalledTimes(2);

    formal.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(instances[1]?.destroy).not.toHaveBeenCalled();

    // The other configuration stays cached and reusable.
    await rewrite({ input: "Loosen this up.", tone: "more-casual" });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("clear detaches leased sessions and destroys them on final release", async () => {
    const { api, instances } = installFakeApi();
    const lease = prepareRewriter();
    await lease.ready;

    clearRewriterSessions();
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();

    // The detached session no longer serves new calls.
    await rewrite({ input: "Make this clearer." });
    expect(api.create).toHaveBeenCalledTimes(2);

    lease.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("re-trims the cache when the last in-flight pin drops", async () => {
    const { api, instances } = installFakeApi();
    configureRewriterCache({ max: 0 });

    await rewrite({ input: "Make this clearer." });
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);

    // Nothing stayed cached, so the same call creates a fresh session.
    await rewrite({ input: "Make this clearer." });
    expect(api.create).toHaveBeenCalledTimes(2);
  });
});
