import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearSessionCacheForTests,
  __configureCacheForTests,
} from "./api.js";
import {
  ask,
  checkAvailability,
  createSession,
  isAvailable,
  PromptAbortError,
  PromptUnavailableError,
  type ResponseCache,
} from "./index.js";

interface FakeSession {
  prompt: ReturnType<typeof vi.fn>;
  promptStreaming?: ReturnType<typeof vi.fn>;
  destroy?: ReturnType<typeof vi.fn>;
  clone?: ReturnType<typeof vi.fn>;
  append?: ReturnType<typeof vi.fn>;
  contextWindow?: number;
  contextUsage?: number;
  inputQuota?: number;
  inputUsage?: number;
  addEventListener?: ReturnType<typeof vi.fn>;
  removeEventListener?: ReturnType<typeof vi.fn>;
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
  return Object.assign(api, { promptSpy, streamingSpy });
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

describe("isAvailable", () => {
  it("is false when the global is missing", () => {
    expect(isAvailable()).toBe(false);
  });

  it("is true when the global is present", () => {
    installFakeLanguageModel();
    expect(isAvailable()).toBe(true);
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
    expect(result).toEqual({ output: null, cached: false });
  });

  it("returns the cached response without calling the model", async () => {
    const fake = installFakeLanguageModel();
    const cache = inMemoryCache();
    cache.set('["hello","",null,null]', "cached answer");
    const result = await ask({ input: "hello", cache });
    expect(result).toEqual({ output: "cached answer", cached: true });
    expect(fake.create).not.toHaveBeenCalled();
  });

  it("does not collide cache entries when language hints differ", async () => {
    let calls = 0;
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => `answer ${++calls}`),
      }),
    });
    const cache = inMemoryCache();

    const first = await ask({
      input: "hello",
      language: "en",
      supportedLanguages: ["en", "es"],
      cache,
    });
    const second = await ask({
      input: "hello",
      language: "es",
      supportedLanguages: ["en", "es"],
      cache,
    });

    expect(first).toEqual({ output: "answer 1", cached: false });
    expect(second).toEqual({ output: "answer 2", cached: false });
  });

  it("does not collide cache entries for supported and unsupported language hints", async () => {
    let calls = 0;
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => `answer ${++calls}`),
      }),
    });
    const cache = inMemoryCache();

    const first = await ask({
      input: "hello",
      language: "pt-BR",
      supportedLanguages: ["pt"],
      cache,
    });
    const second = await ask({
      input: "hello",
      language: "pt-BR",
      supportedLanguages: ["en"],
      cache,
    });

    expect(first).toEqual({ output: "answer 1", cached: false });
    expect(second).toEqual({ output: "answer 2", cached: false });
  });

  it("does not fragment cache entries for unsupported language hint lists", async () => {
    let calls = 0;
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => `answer ${++calls}`),
      }),
    });
    const cache = inMemoryCache();

    const first = await ask({
      input: "hello",
      language: "pt-BR",
      supportedLanguages: ["en"],
      cache,
    });
    const second = await ask({
      input: "hello",
      language: "pt-BR",
      supportedLanguages: ["ja"],
      cache,
    });

    expect(first).toEqual({ output: "answer 1", cached: false });
    expect(second).toEqual({ output: "answer 1", cached: true });
  });

  it("does not collide cache entries when expected input or output hints differ", async () => {
    let calls = 0;
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => `answer ${++calls}`),
      }),
    });
    const cache = inMemoryCache();

    const first = await ask({
      input: "hello",
      expectedInputs: [{ type: "text", languages: ["en"] }],
      cache,
    });
    const second = await ask({
      input: "hello",
      expectedOutputs: [{ type: "text", languages: ["es"] }],
      cache,
    });

    expect(first).toEqual({ output: "answer 1", cached: false });
    expect(second).toEqual({ output: "answer 2", cached: false });
  });

  it("does not collide cache entries when response constraints differ", async () => {
    let calls = 0;
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => `answer ${++calls}`),
      }),
    });
    const cache = inMemoryCache();

    const first = await ask({
      input: "hello",
      responseConstraint: {
        type: "object",
        properties: { value: { type: "string" } },
      },
      cache,
    });
    const second = await ask({
      input: "hello",
      responseConstraint: {
        type: "object",
        properties: { value: { type: "number" } },
      },
      omitResponseConstraintInput: true,
      cache,
    });

    expect(first).toEqual({ output: "answer 1", cached: false });
    expect(second).toEqual({ output: "answer 2", cached: false });
  });

  it("does not fragment cache entries for omitResponseConstraintInput without a constraint", async () => {
    let calls = 0;
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => `answer ${++calls}`),
      }),
    });
    const cache = inMemoryCache();

    const first = await ask({
      input: "hello",
      cache,
    });
    const second = await ask({
      input: "hello",
      omitResponseConstraintInput: true,
      cache,
    });

    expect(first).toEqual({ output: "answer 1", cached: false });
    expect(second).toEqual({ output: "answer 1", cached: true });
  });

  it("does not collide cache entries when tool descriptors differ", async () => {
    let calls = 0;
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => `answer ${++calls}`),
      }),
    });
    const cache = inMemoryCache();
    const execute = vi.fn(async () => "tool result");

    const first = await ask({
      input: "what can you do?",
      tools: [
        {
          name: "get_time",
          description: "Return the current time.",
          inputSchema: { type: "object", properties: {} },
          execute,
        },
      ],
      cache,
    });
    const second = await ask({
      input: "what can you do?",
      tools: [
        {
          name: "get_weather",
          description: "Return the weather.",
          inputSchema: {
            type: "object",
            properties: { city: { type: "string" } },
          },
          execute,
        },
      ],
      cache,
    });

    expect(first).toEqual({ output: "answer 1", cached: false });
    expect(second).toEqual({ output: "answer 2", cached: false });
    expect(execute).not.toHaveBeenCalled();
  });

  it("one-shots when the session has no promptStreaming", async () => {
    installFakeLanguageModel({ response: "one-shot answer" });
    const cache = inMemoryCache();
    const result = await ask({ input: "ping", cache });
    expect(result).toEqual({ output: "one-shot answer", cached: false });
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
    expect(result.output).toBe("Hello, world.");
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
      response: "".repeat(32),
    });
    const result = await ask({
      input: "blocked content",
      cache: inMemoryCache(),
    });
    expect(result.output).toBeNull();
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
    expect(result.output).toBeNull();
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
    expect(result.output).toBe("Hello, world.");
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

  it("forwards samplingMode when provided", async () => {
    const fake = installFakeLanguageModel();
    await ask({
      input: "ping",
      samplingMode: "creative",
      cache: inMemoryCache(),
    });
    const createOpts = fake.create.mock.calls[0]?.[0];
    expect(createOpts).toMatchObject({ samplingMode: "creative" });
  });

  it("rejects mixed samplingMode and raw sampling parameters", async () => {
    installFakeLanguageModel();
    await expect(
      ask({
        input: "ping",
        samplingMode: "balanced",
        temperature: 0.2,
        cache: inMemoryCache(),
      }),
    ).rejects.toThrow(TypeError);
    await expect(
      ask({
        input: "ping",
        samplingMode: "balanced",
        topK: 5,
        cache: inMemoryCache(),
      }),
    ).rejects.toThrow(TypeError);
  });

  it("forwards tools to LanguageModel.create() without executing them", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const execute = vi.fn(async () => "tool result");
    const tools = [
      {
        name: "get_time",
        description: "Return the current time.",
        inputSchema: { type: "object", properties: {} },
        execute,
      },
    ];
    await ask({ input: "what time is it", tools, cache: inMemoryCache() });
    const createOpts = fake.create.mock.calls[0]?.[0];
    expect(createOpts).toMatchObject({ tools });
    // Pass-through only: the SDK must never invoke execute itself.
    expect(execute).not.toHaveBeenCalled();
  });

  it("omits the tools key entirely when no tools are passed", async () => {
    const fake = installFakeLanguageModel();
    await ask({ input: "ping", cache: inMemoryCache() });
    const createOpts = fake.create.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(createOpts).not.toHaveProperty("tools");
  });

  it("clones a warm base session for same-shape one-shot calls", async () => {
    const basePrompt = vi.fn(async () => "base should not be prompted");
    const baseDestroy = vi.fn();
    const clones: Array<FakeSession & { inputs: string[] }> = [];
    const cloneSpy = vi.fn(async () => {
      const inputs: string[] = [];
      const clone: FakeSession & { inputs: string[] } = {
        inputs,
        prompt: vi.fn(async (input: string) => {
          inputs.push(input);
          return `reply:${input}`;
        }),
        destroy: vi.fn(),
      };
      clones.push(clone);
      return clone;
    });
    const fake = installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: basePrompt,
        clone: cloneSpy,
        destroy: baseDestroy,
      }),
    });
    const cache = inMemoryCache();

    await ask({ input: "first", systemPrompt: "S", cache });
    await ask({ input: "second", systemPrompt: "S", cache });

    expect(fake.create).toHaveBeenCalledTimes(1);
    expect(cloneSpy).toHaveBeenCalledTimes(2);
    expect(basePrompt).not.toHaveBeenCalled();
    expect(baseDestroy).not.toHaveBeenCalled();
    expect(clones).toHaveLength(2);
    expect(clones[0]?.inputs).toEqual(["first"]);
    expect(clones[1]?.inputs).toEqual(["second"]);
    expect(clones[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(clones[1]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("creates a fresh one-shot session per call when clone is unavailable", async () => {
    const sessions: Array<FakeSession & { inputs: string[] }> = [];
    const fake = installFakeLanguageModel({
      sessionFactory: () => {
        const inputs: string[] = [];
        const session: FakeSession & { inputs: string[] } = {
          inputs,
          prompt: vi.fn(async (input: string) => {
            inputs.push(input);
            return `reply:${input}`;
          }),
          destroy: vi.fn(),
        };
        sessions.push(session);
        return session;
      },
    });
    const cache = inMemoryCache();

    await ask({ input: "first", systemPrompt: "S", cache });
    await ask({ input: "second", systemPrompt: "S", cache });

    const promptedSessions = sessions.filter(({ inputs }) => inputs.length > 0);
    expect(fake.create).toHaveBeenCalledTimes(3);
    expect(promptedSessions).toHaveLength(2);
    expect(promptedSessions[0]?.inputs).toEqual(["first"]);
    expect(promptedSessions[1]?.inputs).toEqual(["second"]);
    expect(promptedSessions[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(promptedSessions[1]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("does not share a no-clone instance across concurrent same-shape calls", async () => {
    const sessions: Array<FakeSession & { inputs: string[] }> = [];
    const fake = installFakeLanguageModel({
      sessionFactory: () => {
        const inputs: string[] = [];
        const session: FakeSession & { inputs: string[] } = {
          inputs,
          prompt: vi.fn(async (input: string) => {
            inputs.push(input);
            return `reply:${input}`;
          }),
          destroy: vi.fn(),
        };
        sessions.push(session);
        return session;
      },
    });
    const cache = inMemoryCache();

    await Promise.all([
      ask({ input: "first", systemPrompt: "S", cache }),
      ask({ input: "second", systemPrompt: "S", cache }),
    ]);

    const promptedSessions = sessions.filter(({ inputs }) => inputs.length > 0);
    expect(promptedSessions).toHaveLength(2);
    expect(promptedSessions[0]).not.toBe(promptedSessions[1]);
    expect(promptedSessions.map(({ inputs }) => inputs)).toEqual([
      ["first"],
      ["second"],
    ]);
    expect(fake.create).toHaveBeenCalledTimes(3);
  });

  it("bounds remembered no-clone create-option shapes", async () => {
    __configureCacheForTests(1);
    const fake = installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "reply"),
        destroy: vi.fn(),
      }),
    });
    const cache = inMemoryCache();

    await ask({ input: "first", systemPrompt: "one", cache });
    await ask({ input: "second", systemPrompt: "two", cache });
    await ask({ input: "third", systemPrompt: "one", cache });

    // Each unseen no-clone shape probes once, then falls back to a fresh
    // one-shot instance. Reusing an evicted shape probes again instead of
    // letting the no-clone tracker grow without bound.
    expect(fake.create).toHaveBeenCalledTimes(6);
  });

  it("creates a new session when create options differ", async () => {
    const fake = installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "base should not be prompted"),
        clone: vi.fn(async () => ({
          prompt: vi.fn(async () => "reply"),
          destroy: vi.fn(),
        })),
        destroy: vi.fn(),
      }),
    });
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

  it("does not create a session when availability is 'unavailable'", async () => {
    const fake = installFakeLanguageModel({ availability: "unavailable" });
    fake.create.mockRejectedValue(new Error("create should not be called"));

    await expect(
      ask({ input: "hi", cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(PromptUnavailableError);
    expect(fake.create).not.toHaveBeenCalled();
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

  it("aborts a streaming ask between yielded chunks", async () => {
    let resolveGate: () => void = () => {};
    const gate = new Promise<void>((r) => {
      resolveGate = r;
    });
    const session: FakeSession = {
      prompt: vi.fn(),
      promptStreaming: vi.fn(async function* () {
        yield "a";
        await gate;
        yield "b";
      }),
      destroy: vi.fn(),
    };
    installFakeLanguageModel({ sessionFactory: () => session });

    const controller = new AbortController();
    const updates: string[] = [];
    const p = ask({
      input: "hi",
      signal: controller.signal,
      onUpdate: (t) => updates.push(t),
    });
    for (let i = 0; i < 50 && updates.length === 0; i++) {
      await Promise.resolve();
    }
    expect(updates).toEqual(["a"]);
    controller.abort();
    resolveGate();
    await expect(p).rejects.toBeInstanceOf(PromptAbortError);
    expect(updates).toEqual(["a"]);
    expect(session.destroy).toHaveBeenCalled();
  });

  it('honors cache: "session" via sessionStorage', async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: vi.fn((k: string) => store.get(k) ?? null),
      setItem: vi.fn((k: string, v: string) => {
        store.set(k, v);
      }),
    };
    vi.stubGlobal("sessionStorage", storage);
    try {
      const fake = installFakeLanguageModel();
      const first = await ask({
        input: "hi",
        cache: "session",
        cacheKey: "k",
      });
      expect(first).toEqual({ output: "Hello, world.", cached: false });
      expect(storage.setItem).toHaveBeenCalledWith("prompt:k", "Hello, world.");

      const createsAfterFirst = fake.create.mock.calls.length;
      const second = await ask({
        input: "hi",
        cache: "session",
        cacheKey: "k",
      });
      expect(second).toEqual({ output: "Hello, world.", cached: true });
      expect(fake.create).toHaveBeenCalledTimes(createsAfterFirst);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('honors cache: "local" via localStorage', async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: vi.fn((k: string) => store.get(k) ?? null),
      setItem: vi.fn((k: string, v: string) => {
        store.set(k, v);
      }),
    };
    vi.stubGlobal("localStorage", storage);
    try {
      const fake = installFakeLanguageModel();
      const first = await ask({
        input: "hi",
        cache: "local",
        cacheKey: "k",
      });
      expect(first).toEqual({ output: "Hello, world.", cached: false });
      expect(storage.setItem).toHaveBeenCalledWith("prompt:k", "Hello, world.");

      const createsAfterFirst = fake.create.mock.calls.length;
      const second = await ask({
        input: "hi",
        cache: "local",
        cacheKey: "k",
      });
      expect(second).toEqual({ output: "Hello, world.", cached: true });
      expect(fake.create).toHaveBeenCalledTimes(createsAfterFirst);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("aborts without writing the cache", async () => {
    installFakeLanguageModel();
    const cache = { get: vi.fn(() => null), set: vi.fn() };
    const controller = new AbortController();
    controller.abort();
    await expect(
      ask({ input: "hi", cache, signal: controller.signal }),
    ).rejects.toBeInstanceOf(PromptAbortError);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("aborts a streaming ask without writing the cache", async () => {
    let resolveGate: () => void = () => {};
    const gate = new Promise<void>((r) => {
      resolveGate = r;
    });
    const session: FakeSession = {
      prompt: vi.fn(),
      promptStreaming: vi.fn(async function* () {
        yield "a";
        await gate;
        yield "b";
      }),
      destroy: vi.fn(),
    };
    installFakeLanguageModel({ sessionFactory: () => session });

    const controller = new AbortController();
    const cache = { get: vi.fn(() => null), set: vi.fn() };
    const updates: string[] = [];
    const p = ask({
      input: "hi",
      cache,
      signal: controller.signal,
      onUpdate: (t) => updates.push(t),
    });
    for (let i = 0; i < 50 && updates.length === 0; i++) {
      await Promise.resolve();
    }
    expect(updates).toEqual(["a"]);
    controller.abort();
    resolveGate();
    await expect(p).rejects.toBeInstanceOf(PromptAbortError);
    expect(cache.set).not.toHaveBeenCalled();
  });
});

describe("createSession", () => {
  it("keeps createOptions.initialPrompts authoritative and warns once about conflicts", () => {
    const fake = installFakeLanguageModel();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const advancedPrompts = [
      { role: "system" as const, content: "Use the restored persona." },
      { role: "user" as const, content: "A restored turn." },
    ];

    const systemOnly = createSession({ systemPrompt: "Use the shorthand." });
    const advancedOnly = createSession({
      createOptions: { initialPrompts: advancedPrompts },
    });

    expect(warn).not.toHaveBeenCalled();
    expect(fake.create.mock.calls[0]?.[0]).toMatchObject({
      initialPrompts: [{ role: "system", content: "Use the shorthand." }],
    });
    expect(fake.create.mock.calls[1]?.[0]).toMatchObject({
      initialPrompts: advancedPrompts,
    });

    const firstConflict = createSession({
      systemPrompt: "This must be ignored.",
      createOptions: { initialPrompts: advancedPrompts },
    });
    const repeatedConflict = createSession({
      systemPrompt: "This must also be ignored.",
      createOptions: { initialPrompts: advancedPrompts },
    });

    expect(fake.create.mock.calls[2]?.[0]).toMatchObject({
      initialPrompts: advancedPrompts,
    });
    expect(fake.create.mock.calls[3]?.[0]).toMatchObject({
      initialPrompts: advancedPrompts,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[@web-ai-sdk/prompt] `systemPrompt` was ignored because `createOptions.initialPrompts` was also provided; `createOptions.initialPrompts` takes precedence.",
    );

    systemOnly.destroy();
    advancedOnly.destroy();
    firstConflict.destroy();
    repeatedConflict.destroy();
    warn.mockRestore();
  });

  it("never shares an instance across calls (parallel chats stream concurrently)", async () => {
    const fake = installFakeLanguageModel();
    const a = createSession({ systemPrompt: "X" });
    const b = createSession({ systemPrompt: "X" });
    // Creation starts eagerly; no send is needed to trigger it.
    expect(fake.create).toHaveBeenCalledTimes(2);
    a.destroy();
    b.destroy();
  });

  it("bypasses the ask() session cache", async () => {
    const fake = installFakeLanguageModel();
    await ask({ input: "ping", systemPrompt: "S" });
    const createCountAfterAsk = fake.create.mock.calls.length;
    const session = createSession({ systemPrompt: "S" });
    await Promise.resolve();
    expect(fake.create).toHaveBeenCalledTimes(createCountAfterAsk + 1);
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

  it("destroy() aborts an in-flight sendStreaming and marks the session destroyed", async () => {
    let resolveGate: () => void = () => {};
    const gate = new Promise<void>((r) => {
      resolveGate = r;
    });
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(),
        promptStreaming: vi.fn(async function* () {
          yield "a";
          await gate;
          yield "b";
        }),
        destroy: vi.fn(),
      }),
    });

    const session = createSession();
    const collected: string[] = [];
    let rejection: unknown;
    const drain = (async () => {
      try {
        for await (const d of session.sendStreaming("hi")) collected.push(d);
      } catch (e) {
        rejection = e;
      }
    })();
    for (let i = 0; i < 50 && collected.length === 0; i++) {
      await Promise.resolve();
    }
    expect(collected).toEqual(["a"]);
    session.destroy();
    expect(session.destroyed).toBe(true);
    resolveGate();
    await drain;
    expect(collected).toEqual(["a"]);
    expect(rejection).toBeInstanceOf(PromptAbortError);
  });

  it("does NOT queue concurrent sends; consumers handle sequencing themselves", async () => {
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
    expect(maxActive).toBe(2);
    session.destroy();
  });

  it("forwards tools to the underlying LanguageModel.create()", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const execute = vi.fn(async () => "tool result");
    const tools = [
      {
        name: "fetch_url",
        description: "Fetch a URL and return its text.",
        inputSchema: {
          type: "object",
          properties: { url: { type: "string" } },
          required: ["url"],
        },
        execute,
      },
    ];
    const session = createSession({ systemPrompt: "S", tools });
    await session.send("warm");
    const createOpts = fake.create.mock.calls[0]?.[0];
    expect(createOpts).toMatchObject({ tools });
    expect(execute).not.toHaveBeenCalled();
    session.destroy();
  });

  it("forwards samplingMode to the underlying LanguageModel.create()", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession({
      systemPrompt: "S",
      samplingMode: "most-predictable",
    });
    await session.send("warm");
    const createOpts = fake.create.mock.calls[0]?.[0];
    expect(createOpts).toMatchObject({
      samplingMode: "most-predictable",
    });
    session.destroy();
  });

  it("forwards monitor to the underlying LanguageModel.create()", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const monitor = vi.fn();
    const session = createSession({ systemPrompt: "S", monitor });
    await session.send("warm");
    const createOpts = fake.create.mock.calls[0]?.[0];
    expect(createOpts).toMatchObject({ monitor });
    session.destroy();
  });

  it("top-level monitor wins over createOptions.monitor", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const top = vi.fn();
    const inner = vi.fn();
    const session = createSession({
      systemPrompt: "S",
      monitor: top,
      createOptions: { monitor: inner },
    });
    await session.send("warm");
    const createOpts = fake.create.mock.calls[0]?.[0];
    expect(createOpts).toMatchObject({ monitor: top });
    expect(createOpts).not.toMatchObject({ monitor: inner });
    session.destroy();
  });

  it("rejects createSession options that mix semantic and raw sampling", () => {
    installFakeLanguageModel({ response: "ok" });
    expect(() =>
      createSession({
        samplingMode: "creative",
        temperature: 0.8,
      }),
    ).toThrow(TypeError);
    expect(() =>
      createSession({
        samplingMode: "creative",
        createOptions: { topK: 8 },
      }),
    ).toThrow(TypeError);
    expect(() =>
      createSession({
        topK: 8,
        createOptions: { samplingMode: "creative" },
      }),
    ).toThrow(TypeError);
  });

  it("does not set a tools key when none are passed", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession({ systemPrompt: "S" });
    await session.send("warm");
    const createOpts = fake.create.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(createOpts).not.toHaveProperty("tools");
    session.destroy();
  });

  it("forwards omitResponseConstraintInput to the native prompt options", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    await session.send("hi", {
      responseConstraint: { type: "object" },
      omitResponseConstraintInput: true,
    });
    expect(fake.promptSpy).toHaveBeenCalledWith(
      "hi",
      expect.objectContaining({
        responseConstraint: { type: "object" },
        omitResponseConstraintInput: true,
      }),
    );
    session.destroy();
  });

  it("drops omitResponseConstraintInput when no responseConstraint is set (native would throw)", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    await session.send("hi", { omitResponseConstraintInput: true });
    const opts = fake.promptSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(opts).not.toHaveProperty("omitResponseConstraintInput");
    session.destroy();
  });
});

describe("Session.send with message arrays", () => {
  it("forwards a message array unchanged, preserving prefix:true on the trailing assistant message", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    const messages = [
      { role: "user" as const, content: "Return JSON." },
      {
        role: "assistant" as const,
        content: '{"thought":"',
        prefix: true,
      },
    ];
    await session.send(messages);
    expect(fake.promptSpy).toHaveBeenCalledTimes(1);
    expect(fake.promptSpy.mock.calls[0]?.[0]).toEqual(messages);
    session.destroy();
  });

  it("forwards a multi-message turn array as-is", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    const messages = [
      { role: "user" as const, content: "a" },
      { role: "assistant" as const, content: "b" },
      { role: "user" as const, content: "c" },
    ];
    await session.send(messages);
    expect(fake.promptSpy.mock.calls[0]?.[0]).toEqual(messages);
    session.destroy();
  });

  it("still accepts a plain string (regression)", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    await session.send("ping");
    expect(fake.promptSpy.mock.calls[0]?.[0]).toBe("ping");
    session.destroy();
  });

  it("short-circuits an empty array without calling the model", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    const result = await session.send([]);
    expect(result).toBeNull();
    expect(fake.promptSpy).not.toHaveBeenCalled();
    session.destroy();
  });

  it("short-circuits an all-empty-content array without calling the model", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    const result = await session.send([{ role: "user", content: "   " }]);
    expect(result).toBeNull();
    expect(fake.promptSpy).not.toHaveBeenCalled();
    session.destroy();
  });

  it("sendStreaming forwards a prefill array and yields chunks", async () => {
    const fake = installFakeLanguageModel({ chunks: ['"hi"', "}"] });
    const session = createSession();
    const messages = [
      { role: "user" as const, content: "Return JSON." },
      {
        role: "assistant" as const,
        content: '{"thought":"',
        prefix: true,
      },
    ];
    const deltas: string[] = [];
    for await (const d of session.sendStreaming(messages)) {
      deltas.push(d);
    }
    expect(deltas).toEqual(['"hi"', "}"]);
    expect(fake.streamingSpy).not.toBeNull();
    expect(fake.streamingSpy?.mock.calls[0]?.[0]).toEqual(messages);
    session.destroy();
  });

  it("forwards a prefill array from a clone()d session", async () => {
    const childPrompt = vi.fn(async (_input: unknown) => "child reply");
    const cloneSpy = vi.fn(async () => ({
      prompt: childPrompt,
      destroy: vi.fn(),
    }));
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "parent reply"),
        destroy: vi.fn(),
        clone: cloneSpy,
      }),
    });
    const base = createSession({ systemPrompt: "S" });
    await base.send("warm");
    const turn = await base.clone();
    const messages = [
      { role: "user" as const, content: "go" },
      { role: "assistant" as const, content: "{", prefix: true },
    ];
    const result = await turn.send(messages);
    expect(result).toBe("child reply");
    expect(childPrompt).toHaveBeenCalledTimes(1);
    expect(childPrompt.mock.calls[0]?.[0]).toEqual(messages);
    turn.destroy();
    base.destroy();
  });
});

describe("Session multimodal content", () => {
  const imageValue = new Blob(["fake-image-bytes"], { type: "image/png" });
  const audioValue = new Uint8Array([1, 2, 3, 4]);

  it("send forwards mixed text/image/audio content losslessly, by reference", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, value: "Describe this image and audio." },
          { type: "image" as const, value: imageValue },
          { type: "audio" as const, value: audioValue },
        ],
      },
    ];
    await session.send(messages);
    // Lossless pass-through: the exact same array and media values, with no
    // serialization, cloning, coercion, or reordering.
    expect(fake.promptSpy.mock.calls[0]?.[0]).toBe(messages);
    const forwarded = fake.promptSpy.mock.calls[0]?.[0] as typeof messages;
    expect(forwarded[0]?.content[1]?.value).toBe(imageValue);
    expect(forwarded[0]?.content[2]?.value).toBe(audioValue);
    session.destroy();
  });

  it("does not treat an image-only message as empty", async () => {
    const fake = installFakeLanguageModel({ response: "A red square." });
    const session = createSession();
    const result = await session.send([
      { role: "user", content: [{ type: "image", value: imageValue }] },
    ]);
    expect(result).toBe("A red square.");
    expect(fake.promptSpy).toHaveBeenCalledTimes(1);
    session.destroy();
  });

  it("does not treat an audio-only message as empty", async () => {
    const fake = installFakeLanguageModel({ response: "A short chime." });
    const session = createSession();
    const result = await session.send([
      { role: "user", content: [{ type: "audio", value: audioValue }] },
    ]);
    expect(result).toBe("A short chime.");
    expect(fake.promptSpy).toHaveBeenCalledTimes(1);
    session.destroy();
  });

  it("short-circuits a message whose parts are only empty text", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    const result = await session.send([
      {
        role: "user",
        content: [
          { type: "text", value: "   " },
          { type: "text", value: "" },
        ],
      },
    ]);
    expect(result).toBeNull();
    expect(fake.promptSpy).not.toHaveBeenCalled();
    session.destroy();
  });

  it("short-circuits an empty content array", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    const result = await session.send([{ role: "user", content: [] }]);
    expect(result).toBeNull();
    expect(fake.promptSpy).not.toHaveBeenCalled();
    session.destroy();
  });

  it("sends a message that mixes an empty text part with media", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    const result = await session.send([
      {
        role: "user",
        content: [
          { type: "text", value: "   " },
          { type: "image", value: imageValue },
        ],
      },
    ]);
    expect(result).toBe("ok");
    expect(fake.promptSpy).toHaveBeenCalledTimes(1);
    session.destroy();
  });

  it("sendStreaming forwards multimodal messages and yields deltas", async () => {
    const fake = installFakeLanguageModel({ chunks: ["A red ", "square."] });
    const session = createSession();
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, value: "Describe:" },
          { type: "image" as const, value: imageValue },
        ],
      },
    ];
    const deltas: string[] = [];
    for await (const d of session.sendStreaming(messages)) deltas.push(d);
    expect(deltas).toEqual(["A red ", "square."]);
    expect(fake.streamingSpy?.mock.calls[0]?.[0]).toBe(messages);
    session.destroy();
  });

  it("sendStreaming does not stream a media-only message as empty", async () => {
    const fake = installFakeLanguageModel({ chunks: ["chime"] });
    const session = createSession();
    const deltas: string[] = [];
    for await (const d of session.sendStreaming([
      { role: "user", content: [{ type: "audio", value: audioValue }] },
    ])) {
      deltas.push(d);
    }
    expect(deltas).toEqual(["chime"]);
    expect(fake.streamingSpy).toHaveBeenCalledTimes(1);
    session.destroy();
  });

  it("forwards multimodal initialPrompts and expectedInputs to create()", async () => {
    const fake = installFakeLanguageModel({ response: "ok" });
    const expectedInputs = [
      { type: "text" as const },
      { type: "image" as const },
      { type: "audio" as const },
    ];
    const initialPrompts = [
      { role: "system" as const, content: "Describe media." },
      {
        role: "user" as const,
        content: [
          { type: "text" as const, value: "Prior turn." },
          { type: "image" as const, value: imageValue },
        ],
      },
    ];
    const session = createSession({
      expectedInputs,
      createOptions: { initialPrompts },
    });
    await session.send("warm");
    const createOpts = fake.create.mock.calls[0]?.[0] as {
      initialPrompts: unknown;
      expectedInputs: unknown;
    };
    expect(createOpts.initialPrompts).toBe(initialPrompts);
    expect(createOpts.expectedInputs).toBe(expectedInputs);
    session.destroy();
  });

  it("checkAvailability forwards the same expectedInputs used for creation", async () => {
    const fake = installFakeLanguageModel();
    const expectedInputs = [
      { type: "text" as const },
      { type: "image" as const },
      { type: "audio" as const },
    ];
    const availability = await checkAvailability({ expectedInputs });
    expect(availability).toBe("available");
    expect(fake.availability).toHaveBeenCalledWith({ expectedInputs });
  });

  it("append forwards multimodal messages losslessly", async () => {
    const appendSpy = vi.fn(async (_messages: unknown, _opts?: unknown) => {});
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "ok"),
        append: appendSpy,
        destroy: vi.fn(),
      }),
    });
    const session = createSession();
    await session.send("warm");
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, value: "Reference screenshot:" },
          { type: "image" as const, value: imageValue },
        ],
      },
    ];
    await session.append(messages);
    expect(appendSpy.mock.calls[0]?.[0]).toBe(messages);
    session.destroy();
  });

  it("rejects a pre-aborted multimodal send with PromptAbortError", async () => {
    installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    const controller = new AbortController();
    controller.abort();
    await expect(
      session.send(
        [{ role: "user", content: [{ type: "image", value: imageValue }] }],
        { signal: controller.signal },
      ),
    ).rejects.toBeInstanceOf(PromptAbortError);
    session.destroy();
  });

  it("aborts an in-flight multimodal sendStreaming with PromptAbortError", async () => {
    let resolveGate: () => void = () => {};
    const gate = new Promise<void>((r) => {
      resolveGate = r;
    });
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(),
        promptStreaming: vi.fn(async function* () {
          yield "a";
          await gate;
          yield "b";
        }),
        destroy: vi.fn(),
      }),
    });
    const session = createSession();
    const collected: string[] = [];
    let rejection: unknown;
    const drain = (async () => {
      try {
        for await (const d of session.sendStreaming([
          {
            role: "user",
            content: [
              { type: "text", value: "Describe:" },
              { type: "image", value: imageValue },
            ],
          },
        ])) {
          collected.push(d);
        }
      } catch (e) {
        rejection = e;
      }
    })();
    for (let i = 0; i < 50 && collected.length === 0; i++) {
      await Promise.resolve();
    }
    expect(collected).toEqual(["a"]);
    session.abort();
    resolveGate();
    await drain;
    expect(rejection).toBeInstanceOf(PromptAbortError);
    session.destroy();
  });

  it("propagates a native NotSupportedError from prompt() unchanged", async () => {
    const notSupported = new DOMException(
      "Audio input is not supported without a GPU.",
      "NotSupportedError",
    );
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => {
          throw notSupported;
        }),
        destroy: vi.fn(),
      }),
    });
    const session = createSession();
    let caught: unknown;
    try {
      await session.send([
        { role: "user", content: [{ type: "audio", value: audioValue }] },
      ]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBe(notSupported);
    expect(caught).not.toBeInstanceOf(PromptUnavailableError);
    session.destroy();
  });

  it("propagates a native NotSupportedError from create() unchanged", async () => {
    const notSupported = new DOMException(
      "The requested input modality is not supported.",
      "NotSupportedError",
    );
    const fake = installFakeLanguageModel();
    fake.create.mockRejectedValue(notSupported);
    const session = createSession({
      expectedInputs: [{ type: "audio" }],
    });
    let caught: unknown;
    try {
      await session.send([
        { role: "user", content: [{ type: "audio", value: audioValue }] },
      ]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBe(notSupported);
    expect(caught).not.toBeInstanceOf(PromptUnavailableError);
    session.destroy();
  });

  it("maps an aborted create() to PromptAbortError, not PromptUnavailableError", async () => {
    const fake = installFakeLanguageModel();
    fake.create.mockRejectedValue(
      new DOMException("Creation was aborted.", "AbortError"),
    );
    const session = createSession({
      createOptions: { signal: new AbortController().signal },
    });
    await expect(session.send("hi")).rejects.toBeInstanceOf(PromptAbortError);
    session.destroy();
  });

  it("throws SessionDestroyedError for a multimodal send after destroy()", async () => {
    installFakeLanguageModel({ response: "ok" });
    const session = createSession();
    await session.send("warm");
    session.destroy();
    await expect(
      session.send([
        { role: "user", content: [{ type: "image", value: imageValue }] },
      ]),
    ).rejects.toMatchObject({ name: "SessionDestroyedError" });
  });
});

describe("Session.clone", () => {
  it("forks via the native instance.clone() and the clone works independently", async () => {
    const parentDestroy = vi.fn();
    const childDestroy = vi.fn();
    const cloneSpy = vi.fn(async () => ({
      prompt: vi.fn(async () => "child reply"),
      destroy: childDestroy,
    }));
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "parent reply"),
        destroy: parentDestroy,
        clone: cloneSpy,
      }),
    });

    const base = createSession({ systemPrompt: "S" });
    await base.send("warm"); // force the underlying create()
    const turn = await base.clone();
    expect(cloneSpy).toHaveBeenCalledTimes(1);
    expect(await turn.send("go")).toBe("child reply");

    // Destroying the clone tears down the child instance, not the parent.
    turn.destroy();
    await Promise.resolve();
    expect(childDestroy).toHaveBeenCalledTimes(1);
    expect(parentDestroy).not.toHaveBeenCalled();

    // The base session still works after the clone is gone.
    expect(await base.send("again")).toBe("parent reply");
    base.destroy();
  });

  it("throws PromptUnavailableError when the instance has no clone()", async () => {
    installFakeLanguageModel({
      sessionFactory: () => ({ prompt: vi.fn(async () => "x") }),
    });
    const base = createSession();
    await base.send("warm");
    await expect(base.clone()).rejects.toBeInstanceOf(PromptUnavailableError);
    base.destroy();
  });

  it("throws SessionDestroyedError when cloning a destroyed session", async () => {
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "x"),
        clone: vi.fn(),
        destroy: vi.fn(),
      }),
    });
    const base = createSession();
    await base.send("warm");
    base.destroy();
    await expect(base.clone()).rejects.toMatchObject({
      name: "SessionDestroyedError",
    });
  });
});

describe("Session.append", () => {
  it("forwards messages to the native instance.append()", async () => {
    const appendSpy = vi.fn(async () => {});
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "ok"),
        append: appendSpy,
        destroy: vi.fn(),
      }),
    });
    const session = createSession();
    await session.send("warm");
    const messages = [
      { role: "assistant" as const, content: "I called a tool." },
      { role: "user" as const, content: "tool result: 42" },
    ];
    await session.append(messages);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith(
      messages,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    session.destroy();
  });

  it("throws PromptUnavailableError when the instance has no append()", async () => {
    installFakeLanguageModel({
      sessionFactory: () => ({ prompt: vi.fn(async () => "x") }),
    });
    const session = createSession();
    await session.send("warm");
    await expect(
      session.append([{ role: "user", content: "hi" }]),
    ).rejects.toBeInstanceOf(PromptUnavailableError);
    session.destroy();
  });

  it("throws SessionDestroyedError when appending to a destroyed session", async () => {
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "x"),
        append: vi.fn(async () => {}),
        destroy: vi.fn(),
      }),
    });
    const session = createSession();
    await session.send("warm");
    session.destroy();
    await expect(
      session.append([{ role: "user", content: "hi" }]),
    ).rejects.toMatchObject({ name: "SessionDestroyedError" });
  });

  it("rejects with PromptAbortError when the signal aborts", async () => {
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "ok"),
        append: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 20));
        }),
        destroy: vi.fn(),
      }),
    });
    const session = createSession();
    await session.send("warm");
    const controller = new AbortController();
    const pending = session.append([{ role: "user", content: "hi" }], {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(PromptAbortError);
    session.destroy();
  });
});

describe("Session context introspection", () => {
  it("contextWindow / contextUsage are undefined while eager creation is in flight", () => {
    installFakeLanguageModel({ response: "ok" });
    const session = createSession({ systemPrompt: "S" });
    expect(session.contextWindow).toBeUndefined();
    expect(session.contextUsage).toBeUndefined();
    session.destroy();
  });

  it("reads the native contextWindow / contextUsage after a send", async () => {
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "ok"),
        destroy: vi.fn(),
        contextWindow: 4096,
        contextUsage: 12,
      }),
    });
    const session = createSession({ systemPrompt: "S" });
    await session.send("warm");
    expect(session.contextWindow).toBe(4096);
    expect(session.contextUsage).toBe(12);
    session.destroy();
  });

  it("falls back to the deprecated inputQuota / inputUsage on older builds", async () => {
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "ok"),
        destroy: vi.fn(),
        inputQuota: 2048,
        inputUsage: 7,
      }),
    });
    const session = createSession({ systemPrompt: "S" });
    await session.send("warm");
    expect(session.contextWindow).toBe(2048);
    expect(session.contextUsage).toBe(7);
    session.destroy();
  });

  it("exposes the clone's budget synchronously the moment clone() resolves", async () => {
    const cloneSpy = vi.fn(async () => ({
      prompt: vi.fn(async () => "child reply"),
      destroy: vi.fn(),
      contextWindow: 6144,
      contextUsage: 30,
    }));
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "parent reply"),
        destroy: vi.fn(),
        clone: cloneSpy,
        contextWindow: 6144,
        contextUsage: 5,
      }),
    });

    const base = createSession({ systemPrompt: "S" });
    await base.send("warm");
    const turn = await base.clone();
    // No extra await: the values must be readable right away so a consumer
    // can budget the turn's content against the live context window.
    expect(turn.contextWindow).toBe(6144);
    expect(turn.contextUsage).toBe(30);
    turn.destroy();
    base.destroy();
  });
});

describe("Session.onContextOverflow", () => {
  const makeEmitter = () => {
    const listeners = new Map<string, Set<(event: Event) => void>>();
    return {
      addEventListener: vi.fn((type: string, fn: (event: Event) => void) => {
        const set = listeners.get(type) ?? new Set();
        set.add(fn);
        listeners.set(type, set);
      }),
      removeEventListener: vi.fn((type: string, fn: (event: Event) => void) => {
        listeners.get(type)?.delete(fn);
      }),
      emit: (type: string) => {
        for (const fn of listeners.get(type) ?? []) fn(new Event(type));
      },
    };
  };

  it("fires the listener on a native contextoverflow event and stops after cleanup", async () => {
    const emitter = makeEmitter();
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "ok"),
        destroy: vi.fn(),
        addEventListener: emitter.addEventListener,
        removeEventListener: emitter.removeEventListener,
      }),
    });
    const session = createSession({ systemPrompt: "S" });
    await session.send("warm"); // await eager creation before attaching
    const onOverflow = vi.fn();
    const stop = session.onContextOverflow(onOverflow);
    await Promise.resolve();

    emitter.emit("contextoverflow");
    expect(onOverflow).toHaveBeenCalledTimes(1);

    stop();
    emitter.emit("contextoverflow");
    expect(onOverflow).toHaveBeenCalledTimes(1);
    expect(emitter.removeEventListener).toHaveBeenCalledTimes(1);

    // Cleanup is idempotent.
    expect(() => stop()).not.toThrow();
    session.destroy();
  });

  it("never attaches when cleanup runs before eager creation resolves", async () => {
    const emitter = makeEmitter();
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "ok"),
        destroy: vi.fn(),
        addEventListener: emitter.addEventListener,
        removeEventListener: emitter.removeEventListener,
      }),
    });
    const session = createSession({ systemPrompt: "S" });
    const stop = session.onContextOverflow(vi.fn());
    stop(); // synchronously, while eager creation is still in flight
    await session.send("warm");
    await Promise.resolve();
    expect(emitter.addEventListener).not.toHaveBeenCalled();
    session.destroy();
  });

  it("is a no-op (returns a no-op cleanup) when the instance has no events", async () => {
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => "ok"),
        destroy: vi.fn(),
      }),
    });
    const session = createSession();
    await session.send("warm");
    const stop = session.onContextOverflow(vi.fn());
    await Promise.resolve();
    expect(() => stop()).not.toThrow();
    session.destroy();
  });
});

describe("PromptAbortError", () => {
  it("is exported and an aborted send rejects with an instance of it", async () => {
    installFakeLanguageModel({
      sessionFactory: () => ({
        prompt: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 20));
          return "late";
        }),
        destroy: vi.fn(),
      }),
    });
    const session = createSession();
    const controller = new AbortController();
    const pending = session.send("hi", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(PromptAbortError);
    session.destroy();
  });

  it("is the same error ask() throws on abort (instanceof works)", async () => {
    installFakeLanguageModel({ chunks: ["a", "b"] });
    const controller = new AbortController();
    controller.abort();
    await expect(
      ask({ input: "hi", signal: controller.signal, cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(PromptAbortError);
  });
});
