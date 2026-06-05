import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  ask,
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

describe("Session context introspection", () => {
  it("contextWindow / contextUsage are undefined before the instance is created", () => {
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
    await session.send("warm"); // force create() so the listener attaches
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

  it("never attaches when cleanup runs before the instance is created", async () => {
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
    stop(); // before any send → instance not created yet
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
