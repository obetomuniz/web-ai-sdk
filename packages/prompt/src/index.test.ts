import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  PromptUnavailableError,
  type ResponseCache,
  ask,
  clearSession,
  clearSessions,
  configurePromptCache,
  createSession,
  isPromptAvailable,
} from "./index.js";

interface FakeSession {
  prompt: ReturnType<typeof vi.fn>;
  promptStreaming?: ReturnType<typeof vi.fn>;
  destroy?: ReturnType<typeof vi.fn>;
  clone?: ReturnType<typeof vi.fn>;
}

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

const installFakeLanguageModel = (
  opts: {
    response?: string;
    chunks?: string[];
    availability?: "available" | "unavailable";
    sessionFactory?: () => FakeSession;
  } = {},
): FakeApi & {
  promptSpy: ReturnType<typeof vi.fn>;
  streamingSpy: ReturnType<typeof vi.fn> | null;
} => {
  const response = opts.response ?? "Hello, world.";
  const chunks = opts.chunks;
  const availability = opts.availability ?? "available";

  const promptSpy = vi.fn(async () => response);
  const streamingSpy = chunks
    ? vi.fn(async function* () {
        for (const c of chunks) yield c;
      })
    : null;

  const sessionFactory =
    opts.sessionFactory ??
    (() => {
      const session: FakeSession = { prompt: promptSpy };
      if (streamingSpy) session.promptStreaming = streamingSpy;
      session.destroy = vi.fn();
      return session;
    });

  const api: FakeApi = {
    availability: vi.fn(async () => availability),
    create: vi.fn(async () => sessionFactory()),
  };
  (globalThis as { LanguageModel?: FakeApi }).LanguageModel = api;
  return { ...api, promptSpy, streamingSpy };
};

const removeFakeLanguageModel = () => {
  (globalThis as { LanguageModel?: unknown }).LanguageModel = undefined;
};

const inMemoryCache = (): ResponseCache => {
  const store = new Map<string, string>();
  return {
    get: (k) => store.get(k) ?? null,
    set: (k, v) => {
      store.set(k, v);
    },
  };
};

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  removeFakeLanguageModel();
});

describe("isPromptAvailable", () => {
  it("is false when the global is missing", () => {
    expect(isPromptAvailable()).toBe(false);
  });

  it("is true when the global is present", () => {
    installFakeLanguageModel();
    expect(isPromptAvailable()).toBe(true);
  });
});

describe("ask", () => {
  it("throws PromptUnavailableError when the global is missing", async () => {
    await expect(
      ask({ input: "hi", cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(PromptUnavailableError);
  });

  it("returns null when the input is empty", async () => {
    installFakeLanguageModel();
    const result = await ask({ input: "   ", cache: inMemoryCache() });
    expect(result).toEqual({ response: null, cached: false });
  });

  it("returns the cached response without calling the model", async () => {
    const fake = installFakeLanguageModel();
    const cache = inMemoryCache();
    cache.set('["hello","",null,null]', "cached answer");
    const result = await ask({ input: "hello", cache });
    expect(result).toEqual({ response: "cached answer", cached: true });
    expect(fake.create).not.toHaveBeenCalled();
  });

  it("one-shots when the session has no promptStreaming", async () => {
    installFakeLanguageModel({ response: "one-shot answer" });
    const cache = inMemoryCache();
    const result = await ask({ input: "ping", cache });
    expect(result).toEqual({ response: "one-shot answer", cached: false });
    expect(cache.get('["ping","",null,null]')).toBe("one-shot answer");
  });

  it("streams delta chunks (Chrome shape) and reports cumulative buffer via onUpdate", async () => {
    installFakeLanguageModel({ chunks: ["Hel", "lo, ", "world."] });
    const cache = inMemoryCache();
    const updates: string[] = [];
    const result = await ask({
      input: "say hi",
      cache,
      onUpdate: (c) => updates.push(c),
    });
    expect(result.response).toBe("Hello, world.");
    expect(updates).toEqual(["Hel", "Hello, ", "Hello, world."]);
  });

  it("does not cache by default; same call hits the model twice without a `cache` option", async () => {
    const fake = installFakeLanguageModel({ response: "fresh response" });
    await ask({ input: "ping" });
    await ask({ input: "ping" });
    expect(fake.promptSpy).toHaveBeenCalledTimes(2);
  });

  it("returns null when the response is only C0 control characters (Edge soft-block)", async () => {
    installFakeLanguageModel({
      response: "".repeat(32),
    });
    const result = await ask({
      input: "blocked content",
      cache: inMemoryCache(),
    });
    expect(result.response).toBeNull();
    expect(result.cached).toBe(false);
  });

  it("returns null when the response is only invisible Unicode (safety-blocked)", async () => {
    installFakeLanguageModel({
      response: "​­﻿‌‍",
    });
    const result = await ask({
      input: "blocked content",
      cache: inMemoryCache(),
    });
    expect(result.response).toBeNull();
    expect(result.cached).toBe(false);
  });

  it("handles cumulative chunks (Edge / Phi-Silica shape) without double-concatenation", async () => {
    installFakeLanguageModel({
      chunks: ["Hel", "Hello, ", "Hello, world."],
    });
    const cache = inMemoryCache();
    const updates: string[] = [];
    const result = await ask({
      input: "say hi",
      cache,
      onUpdate: (c) => updates.push(c),
    });
    expect(result.response).toBe("Hello, world.");
    expect(updates).toEqual(["Hel", "Hello, ", "Hello, world."]);
  });

  it("folds systemPrompt into LanguageModel.create's initialPrompts", async () => {
    const fake = installFakeLanguageModel();
    await ask({
      input: "ping",
      systemPrompt: "You are concise.",
      cache: inMemoryCache(),
    });
    const createOpts = fake.create.mock.calls[0]?.[0];
    expect(createOpts).toMatchObject({
      initialPrompts: [{ role: "system", content: "You are concise." }],
    });
  });

  it("forwards temperature and topK when provided", async () => {
    const fake = installFakeLanguageModel();
    await ask({
      input: "ping",
      temperature: 0.2,
      topK: 5,
      cache: inMemoryCache(),
    });
    const createOpts = fake.create.mock.calls[0]?.[0];
    expect(createOpts).toMatchObject({ temperature: 0.2, topK: 5 });
  });

  it("warns when createOptions.initialPrompts is passed alongside systemPrompt", async () => {
    installFakeLanguageModel();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ask({
      input: "ping",
      systemPrompt: "Never see me",
      createOptions: { initialPrompts: [{ role: "system", content: "Other" }] },
      cache: inMemoryCache(),
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/initialPrompts.*overrides/),
    );
    warnSpy.mockRestore();
  });

  it("reuses sessions across same-shape calls", async () => {
    const fake = installFakeLanguageModel();
    const cache = inMemoryCache();
    await ask({ input: "first", systemPrompt: "S", cache });
    await ask({ input: "second", systemPrompt: "S", cache });
    expect(fake.create).toHaveBeenCalledTimes(1);
  });

  it("creates a new session when create options differ", async () => {
    const fake = installFakeLanguageModel();
    const cache = inMemoryCache();
    await ask({ input: "ping", systemPrompt: "A", cache });
    await ask({ input: "ping", systemPrompt: "B", cache });
    expect(fake.create).toHaveBeenCalledTimes(2);
  });

  it("throws PromptUnavailableError when availability is 'unavailable'", async () => {
    installFakeLanguageModel({ availability: "unavailable" });
    await expect(
      ask({ input: "hi", cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(PromptUnavailableError);
  });

  it("aborts via AbortSignal", async () => {
    installFakeLanguageModel({ chunks: ["a", "b", "c"] });
    const controller = new AbortController();
    controller.abort();
    await expect(
      ask({
        input: "hi",
        signal: controller.signal,
        cache: inMemoryCache(),
      }),
    ).rejects.toThrow(/aborted/i);
  });
});

describe("session cache (LRU)", () => {
  it("evicts the oldest entry past the configured cap and destroys it", async () => {
    const destroyed: string[] = [];
    let id = 0;
    installFakeLanguageModel({
      sessionFactory: () => {
        const tag = String(++id);
        return {
          prompt: vi.fn(async () => `r${tag}`),
          destroy: vi.fn(() => {
            destroyed.push(tag);
          }),
        };
      },
    });
    configurePromptCache({ max: 2 });
    await ask({ input: "a", systemPrompt: "A" });
    await ask({ input: "a", systemPrompt: "B" });
    await ask({ input: "a", systemPrompt: "C" });
    // Yield to flush the destroy microtask.
    await Promise.resolve();
    await Promise.resolve();
    expect(destroyed).toEqual(["1"]);
  });

  it("clearSessions destroys every cached session and forces fresh creates next time", async () => {
    const fake = installFakeLanguageModel();
    await ask({ input: "ping", systemPrompt: "A" });
    expect(fake.create).toHaveBeenCalledTimes(1);
    clearSessions();
    await ask({ input: "ping", systemPrompt: "A" });
    expect(fake.create).toHaveBeenCalledTimes(2);
  });

  it("clearSession drops a specific cached session by options", async () => {
    const fake = installFakeLanguageModel();
    await ask({ input: "ping", systemPrompt: "A" });
    await ask({ input: "ping", systemPrompt: "B" });
    expect(fake.create).toHaveBeenCalledTimes(2);
    clearSession({ initialPrompts: [{ role: "system", content: "A" }] });
    await ask({ input: "ping", systemPrompt: "B" });
    expect(fake.create).toHaveBeenCalledTimes(2); // B still cached
    await ask({ input: "ping", systemPrompt: "A" });
    expect(fake.create).toHaveBeenCalledTimes(3); // A re-created
  });
});

describe("createSession", () => {
  it("never shares an instance across calls (parallel chats stream concurrently)", async () => {
    const fake = installFakeLanguageModel();
    const a = createSession({ systemPrompt: "X" });
    const b = createSession({ systemPrompt: "X" });
    // Trigger creation by issuing an empty send (returns null without
    // touching the model, but awaits the underlying create()).
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.create).toHaveBeenCalledTimes(2);
    a.destroy();
    b.destroy();
  });

  it("bypasses the ask() session cache", async () => {
    const fake = installFakeLanguageModel();
    await ask({ input: "ping", systemPrompt: "S" });
    const session = createSession({ systemPrompt: "S" });
    await Promise.resolve();
    expect(fake.create).toHaveBeenCalledTimes(2);
    session.destroy();
  });

  it("send() returns cleaned text without exposing turn state on the session", async () => {
    installFakeLanguageModel({ response: "Pong." });
    const session = createSession();
    const text = await session.send("ping");
    expect(text).toBe("Pong.");
    expect("history" in session).toBe(false);
    session.destroy();
  });

  it("sendStreaming yields DELTAS, not cumulative buffers", async () => {
    installFakeLanguageModel({ chunks: ["Hel", "lo, ", "world."] });
    const session = createSession();
    const deltas: string[] = [];
    for await (const d of session.sendStreaming("say hi")) {
      deltas.push(d);
    }
    expect(deltas).toEqual(["Hel", "lo, ", "world."]);
    session.destroy();
  });

  it("sendStreaming yields deltas even when the backend ships cumulative chunks", async () => {
    installFakeLanguageModel({
      chunks: ["Hel", "Hello, ", "Hello, world."],
    });
    const session = createSession();
    const deltas: string[] = [];
    for await (const d of session.sendStreaming("hi")) {
      deltas.push(d);
    }
    expect(deltas).toEqual(["Hel", "lo, ", "world."]);
    session.destroy();
  });

  it("destroy() prevents further sends and invokes the underlying destroy", async () => {
    let destroyed = false;
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "x"),
        destroy: vi.fn(() => {
          destroyed = true;
        }),
      }),
    });
    const session = createSession();
    // Issue a send to wait for the underlying create() before destroying,
    // so the destroy actually has an instance to tear down.
    await session.send("warm").catch(() => {});
    session.destroy();
    await Promise.resolve();
    expect(destroyed).toBe(true);
    await expect(session.send("hi")).rejects.toMatchObject({
      name: "SessionDestroyedError",
    });
  });

  it("does NOT queue concurrent sends; consumers handle sequencing themselves", async () => {
    // The wrapper is transparent — the underlying LanguageModel is sequential
    // per instance and will reject overlapping sends. The hook returns the
    // primitive's behavior without papering over it.
    let active = 0;
    let maxActive = 0;
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async (input: string) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((r) => setTimeout(r, 5));
          active -= 1;
          return `r:${input}`;
        }),
      }),
    });
    const session = createSession();
    await Promise.all([session.send("a"), session.send("b")]);
    // Both sends were dispatched to the fake instance concurrently, because
    // the wrapper does not serialize. Real Chrome would surface
    // InvalidStateError for the second call; our test fake is permissive.
    expect(maxActive).toBe(2);
    session.destroy();
  });
});
