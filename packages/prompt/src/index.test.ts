import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  PromptUnavailableError,
  type ResponseCache,
  isPromptAvailable,
  prompt,
} from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

const installFakeLanguageModel = (
  opts: {
    response?: string;
    chunks?: string[];
    availability?: "available" | "unavailable";
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

  const session = streamingSpy
    ? { prompt: promptSpy, promptStreaming: streamingSpy }
    : { prompt: promptSpy };

  const api: FakeApi = {
    availability: vi.fn(async () => availability),
    create: vi.fn(async () => session),
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

describe("prompt", () => {
  it("throws PromptUnavailableError when the global is missing", async () => {
    await expect(
      prompt({ prompt: "hi", cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(PromptUnavailableError);
  });

  it("returns null when the prompt is empty", async () => {
    installFakeLanguageModel();
    const result = await prompt({ prompt: "   ", cache: inMemoryCache() });
    expect(result).toEqual({ response: null, cached: false });
  });

  it("returns the cached response without calling the model", async () => {
    const fake = installFakeLanguageModel();
    const cache = inMemoryCache();
    cache.set('["hello","",null,null]', "cached answer");
    const result = await prompt({ prompt: "hello", cache });
    expect(result).toEqual({ response: "cached answer", cached: true });
    expect(fake.create).not.toHaveBeenCalled();
  });

  it("one-shots when the session has no promptStreaming", async () => {
    installFakeLanguageModel({ response: "one-shot answer" });
    const cache = inMemoryCache();
    const result = await prompt({ prompt: "ping", cache });
    expect(result).toEqual({ response: "one-shot answer", cached: false });
    expect(cache.get('["ping","",null,null]')).toBe("one-shot answer");
  });

  it("streams delta chunks (Chrome shape) and concatenates the final response", async () => {
    installFakeLanguageModel({ chunks: ["Hel", "lo, ", "world."] });
    const cache = inMemoryCache();
    const chunks: string[] = [];
    const result = await prompt({
      prompt: "say hi",
      cache,
      onChunk: (c) => chunks.push(c),
    });
    expect(result.response).toBe("Hello, world.");
    expect(chunks).toEqual(["Hel", "Hello, ", "Hello, world."]);
  });

  it("does not cache by default; same call hits the model twice without a `cache` option", async () => {
    const fake = installFakeLanguageModel({ response: "fresh response" });
    await prompt({ prompt: "ping" });
    await prompt({ prompt: "ping" });
    // No cache passed: each call should reach the underlying session.
    expect(fake.promptSpy).toHaveBeenCalledTimes(2);
  });

  it("returns null when the response is only C0 control characters (Edge soft-block)", async () => {
    // Edge's safety pipeline observed returning runs of U+0018 (CANCEL) as
    // a soft-block placeholder instead of throwing or returning empty.
    installFakeLanguageModel({
      response: "\u0018".repeat(32),
    });
    const result = await prompt({
      prompt: "blocked content",
      cache: inMemoryCache(),
    });
    expect(result.response).toBeNull();
    expect(result.cached).toBe(false);
  });

  it("returns null when the response is only invisible Unicode (safety-blocked)", async () => {
    // ZWSP + soft hyphen + BOM; what Edge's stricter safety path sometimes
    // emits instead of plain whitespace when blocking a response.
    installFakeLanguageModel({
      response: "\u200B\u00AD\uFEFF\u200C\u200D",
    });
    const result = await prompt({
      prompt: "blocked content",
      cache: inMemoryCache(),
    });
    expect(result.response).toBeNull();
    expect(result.cached).toBe(false);
  });

  it("handles cumulative chunks (Edge / Phi-Silica shape) without double-concatenation", async () => {
    // Each chunk is the FULL text so far instead of the new piece.
    installFakeLanguageModel({
      chunks: ["Hel", "Hello, ", "Hello, world."],
    });
    const cache = inMemoryCache();
    const chunks: string[] = [];
    const result = await prompt({
      prompt: "say hi",
      cache,
      onChunk: (c) => chunks.push(c),
    });
    expect(result.response).toBe("Hello, world.");
    // Buffer should equal the latest cumulative chunk, not a concatenation.
    expect(chunks).toEqual(["Hel", "Hello, ", "Hello, world."]);
  });

  it("folds systemPrompt into LanguageModel.create's initialPrompts", async () => {
    const fake = installFakeLanguageModel();
    await prompt({
      prompt: "ping",
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
    await prompt({
      prompt: "ping",
      temperature: 0.2,
      topK: 5,
      cache: inMemoryCache(),
    });
    const createOpts = fake.create.mock.calls[0]?.[0];
    expect(createOpts).toMatchObject({ temperature: 0.2, topK: 5 });
  });

  it("adds expectedInputs/expectedOutputs for a supported language", async () => {
    const fake = installFakeLanguageModel();
    await prompt({
      prompt: "ping",
      language: "en-US",
      cache: inMemoryCache(),
    });
    const createOpts = fake.create.mock.calls[0]?.[0];
    expect(createOpts.expectedInputs).toEqual([
      { type: "text", languages: ["en"] },
    ]);
    expect(createOpts.expectedOutputs).toEqual([
      { type: "text", languages: ["en"] },
    ]);
  });

  it("omits language hints for unsupported languages", async () => {
    const fake = installFakeLanguageModel();
    await prompt({
      prompt: "ping",
      language: "pt-BR",
      cache: inMemoryCache(),
    });
    const createOpts = fake.create.mock.calls[0]?.[0];
    expect(createOpts.expectedInputs).toBeUndefined();
    expect(createOpts.expectedOutputs).toBeUndefined();
  });

  it("reuses sessions across same-shape calls", async () => {
    const fake = installFakeLanguageModel();
    const cache = inMemoryCache();
    await prompt({ prompt: "first", systemPrompt: "S", cache });
    await prompt({ prompt: "second", systemPrompt: "S", cache });
    expect(fake.create).toHaveBeenCalledTimes(1);
  });

  it("creates a new session when create options differ", async () => {
    const fake = installFakeLanguageModel();
    const cache = inMemoryCache();
    await prompt({ prompt: "ping", systemPrompt: "A", cache });
    await prompt({ prompt: "ping", systemPrompt: "B", cache });
    expect(fake.create).toHaveBeenCalledTimes(2);
  });

  it("throws PromptUnavailableError when availability is 'unavailable'", async () => {
    installFakeLanguageModel({ availability: "unavailable" });
    await expect(
      prompt({ prompt: "hi", cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(PromptUnavailableError);
  });

  it("honors a custom cacheKey", async () => {
    installFakeLanguageModel({ response: "ans" });
    const cache = inMemoryCache();
    await prompt({ prompt: "hi", cacheKey: "custom", cache });
    expect(cache.get("custom")).toBe("ans");
  });

  it("aborts via AbortSignal", async () => {
    installFakeLanguageModel({ chunks: ["a", "b", "c"] });
    const controller = new AbortController();
    controller.abort();
    await expect(
      prompt({
        prompt: "hi",
        signal: controller.signal,
        cache: inMemoryCache(),
      }),
    ).rejects.toThrow(/aborted/i);
  });
});
