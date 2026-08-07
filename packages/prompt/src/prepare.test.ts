import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearSessionCacheForTests,
  configureLanguageModelCache,
} from "./api.js";
import {
  ask,
  clearLanguageModelSessions,
  createSession,
  PromptUnavailableError,
  prepareLanguageModel,
} from "./index.js";

interface FakeClone {
  prompt: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

interface FakeBase {
  prompt: ReturnType<typeof vi.fn>;
  clone: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const makeClone = (): FakeClone => ({
  prompt: vi.fn(async () => "reply"),
  destroy: vi.fn(),
});

const makeBase = (): FakeBase => ({
  prompt: vi.fn(async () => "reply"),
  clone: vi.fn(async () => makeClone()),
  destroy: vi.fn(),
});

const installFakeApi = () => {
  const bases: FakeBase[] = [];
  const api = {
    availability: vi.fn(async () => "available" as const),
    create: vi.fn(async () => {
      const base = makeBase();
      bases.push(base);
      return base;
    }),
  };
  (globalThis as { LanguageModel?: unknown }).LanguageModel = api;
  return { api, bases };
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  (globalThis as { LanguageModel?: unknown }).LanguageModel = undefined;
});

describe("prepareLanguageModel", () => {
  it("starts creation immediately and the matching ask clones the warm base", async () => {
    const { api, bases } = installFakeApi();
    const lease = prepareLanguageModel({ systemPrompt: "sys" });
    expect(api.create).toHaveBeenCalledTimes(1);
    await lease.ready;

    const result = await ask({ input: "hello", systemPrompt: "sys" });
    expect(result.output).toBe("reply");
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(bases[0]?.clone).toHaveBeenCalledTimes(1);
    lease.release();
  });

  it("never throws when the API is missing; ready rejects instead", async () => {
    const lease = prepareLanguageModel({ systemPrompt: "sys" });
    await expect(lease.ready).rejects.toBeInstanceOf(PromptUnavailableError);
    expect(() => lease.release()).not.toThrow();
  });

  it("rejects ready instead of throwing on invalid sampling options", async () => {
    installFakeApi();
    const lease = prepareLanguageModel({
      samplingMode: "balanced",
      temperature: 0.5,
    });
    await expect(lease.ready).rejects.toBeInstanceOf(Error);
    expect(() => lease.release()).not.toThrow();
  });

  it("shares one base between concurrent leases and destroys exactly once", async () => {
    const { api, bases } = installFakeApi();
    const first = prepareLanguageModel({ systemPrompt: "sys" });
    const second = prepareLanguageModel({ systemPrompt: "sys" });
    expect(api.create).toHaveBeenCalledTimes(1);
    await Promise.all([first.ready, second.ready]);

    first.release();
    first.release();
    await tick();
    expect(bases[0]?.destroy).not.toHaveBeenCalled();

    second.release();
    second.release();
    await tick();
    expect(bases[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("release before creation settles destroys the base once created", async () => {
    const { api } = installFakeApi();
    let resolveCreate: (base: FakeBase) => void = () => {};
    const base = makeBase();
    api.create.mockImplementationOnce(
      () =>
        new Promise<FakeBase>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const lease = prepareLanguageModel({ systemPrompt: "sys" });
    lease.release();
    await tick();
    expect(base.destroy).not.toHaveBeenCalled();

    resolveCreate(base);
    await tick();
    expect(base.destroy).toHaveBeenCalledTimes(1);

    // The released entry left the cache, so preparing again creates anew.
    const retry = prepareLanguageModel({ systemPrompt: "sys" });
    expect(api.create).toHaveBeenCalledTimes(2);
    await retry.ready;
    retry.release();
  });

  it("creation failure rejects ready, evicts the entry, and allows retry", async () => {
    const { api } = installFakeApi();
    api.create.mockRejectedValueOnce(new Error("no space"));

    const failed = prepareLanguageModel({ systemPrompt: "sys" });
    await expect(failed.ready).rejects.toBeInstanceOf(PromptUnavailableError);
    failed.release();

    const retry = prepareLanguageModel({ systemPrompt: "sys" });
    expect(api.create).toHaveBeenCalledTimes(2);
    await expect(retry.ready).resolves.toBeUndefined();
    retry.release();
  });

  it("defers base destruction while ask is cloning from it", async () => {
    const { bases } = installFakeApi();
    const lease = prepareLanguageModel({ systemPrompt: "sys" });
    await lease.ready;

    const base = bases[0];
    if (!base) throw new Error("expected a created base");
    let resolveClone: (clone: FakeClone) => void = () => {};
    base.clone.mockImplementationOnce(
      () =>
        new Promise<FakeClone>((resolve) => {
          resolveClone = resolve;
        }),
    );

    const running = ask({ input: "hello", systemPrompt: "sys" });
    await tick();
    lease.release();
    await tick();
    expect(base.destroy).not.toHaveBeenCalled();

    resolveClone(makeClone());
    await expect(running).resolves.toEqual({ output: "reply", cached: false });
    await tick();
    expect(base.destroy).toHaveBeenCalledTimes(1);
  });

  it("pins leased bases against LRU eviction", async () => {
    const { bases } = installFakeApi();
    configureLanguageModelCache({ max: 1 });

    const lease = prepareLanguageModel({ systemPrompt: "keep" });
    await lease.ready;
    await ask({ input: "hello", systemPrompt: "evictable" });
    await tick();

    // Inserting a third entry trims to max; the leased base survives and the
    // unpinned base is evicted.
    const third = prepareLanguageModel({ systemPrompt: "third" });
    await third.ready;
    await tick();
    expect(bases[0]?.destroy).not.toHaveBeenCalled();
    expect(bases[1]?.destroy).toHaveBeenCalledTimes(1);

    lease.release();
    third.release();
  });

  it("isolates leases per option key", async () => {
    const { api, bases } = installFakeApi();
    const kept = prepareLanguageModel({ systemPrompt: "one" });
    await kept.ready;

    await ask({ input: "hello", systemPrompt: "two" });
    expect(api.create).toHaveBeenCalledTimes(2);

    kept.release();
    await tick();
    expect(bases[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(bases[1]?.destroy).not.toHaveBeenCalled();

    // The other configuration stays cached and reusable.
    await ask({ input: "again", systemPrompt: "two" });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("clear detaches leased bases and destroys them on final release", async () => {
    const { api, bases } = installFakeApi();
    const lease = prepareLanguageModel({ systemPrompt: "sys" });
    await lease.ready;

    clearLanguageModelSessions();
    await tick();
    expect(bases[0]?.destroy).not.toHaveBeenCalled();

    // The detached base no longer serves new calls.
    await ask({ input: "hello", systemPrompt: "sys" });
    expect(api.create).toHaveBeenCalledTimes(2);

    lease.release();
    await tick();
    expect(bases[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("does not affect createSession, which stays caller-owned", async () => {
    const { api } = installFakeApi();
    const lease = prepareLanguageModel({});
    await lease.ready;

    // createSession bypasses the warm cache by design.
    const session = createSession();
    await session.send("hello");
    expect(api.create).toHaveBeenCalledTimes(2);

    session.destroy();
    lease.release();
  });

  it("re-trims the cache when the last in-flight pin drops", async () => {
    const { api, bases } = installFakeApi();
    configureLanguageModelCache({ max: 0 });

    await ask({ input: "hello", systemPrompt: "sys" });
    await tick();
    expect(bases[0]?.destroy).toHaveBeenCalledTimes(1);

    // Nothing stayed cached, so the same call creates a fresh session.
    await ask({ input: "hello", systemPrompt: "sys" });
    expect(api.create).toHaveBeenCalledTimes(2);
  });
});
