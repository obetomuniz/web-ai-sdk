import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  isAvailable,
  SummarizerUnavailableError,
  type SummaryCache,
  summarize,
} from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

const installFakeSummarizer = (
  opts: {
    summary?: string;
    chunks?: string[];
    availability?: "available" | "unavailable";
  } = {},
): FakeApi => {
  const summary = opts.summary ?? "TLDR.";
  const chunks = opts.chunks;
  const availability = opts.availability ?? "available";

  const summarizer = chunks
    ? {
        summarize: vi.fn(async () => summary),
        summarizeStreaming: async function* (_text: string) {
          for (const c of chunks) yield c;
        },
      }
    : {
        summarize: vi.fn(async () => summary),
      };

  const api: FakeApi = {
    availability: vi.fn(async () => availability),
    create: vi.fn(async () => summarizer),
  };
  (globalThis as { Summarizer?: FakeApi }).Summarizer = api;
  return api;
};

const removeFakeSummarizer = () => {
  (globalThis as { Summarizer?: unknown }).Summarizer = undefined;
};

const inMemoryCache = (): SummaryCache => {
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
  removeFakeSummarizer();
});

describe("isAvailable", () => {
  it("is false when the global is missing", () => {
    expect(isAvailable()).toBe(false);
  });

  it("is true when the global is present", () => {
    installFakeSummarizer();
    expect(isAvailable()).toBe(true);
  });
});

describe("summarize", () => {
  it("throws SummarizerUnavailableError when the global is missing", async () => {
    await expect(
      summarize({ language: "en", input: "Hello." }),
    ).rejects.toBeInstanceOf(SummarizerUnavailableError);
  });

  it("returns a one-shot summary when streaming is unavailable", async () => {
    installFakeSummarizer({ summary: "Concise overview." });
    const result = await summarize({
      language: "en",
      input: "A long article body that the model summarizes.",
      cache: inMemoryCache(),
    });
    expect(result).toEqual({ output: "Concise overview.", cached: false });
  });

  it("streams delta chunks (Chrome shape) and returns the cleaned final text", async () => {
    installFakeSummarizer({
      chunks: ['"Hello', " world", ' "'],
    });
    const chunks: string[] = [];
    const result = await summarize({
      language: "en",
      input: "Some article body.",
      cache: inMemoryCache(),
      onUpdate: (c) => chunks.push(c),
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(result.output).toBe("Hello world");
    expect(result.cached).toBe(false);
  });

  it("handles cumulative chunks (Edge / Phi-Silica shape) without double-concatenation", async () => {
    // Each chunk is the FULL text so far instead of the new piece.
    installFakeSummarizer({
      chunks: ['"Hello', '"Hello world', '"Hello world "'],
    });
    const chunks: string[] = [];
    const result = await summarize({
      language: "en",
      input: "Some article body.",
      cache: inMemoryCache(),
      onUpdate: (c) => chunks.push(c),
    });
    expect(result.output).toBe("Hello world");
    expect(result.cached).toBe(false);
  });

  it("does not cache by default; same call hits the model twice without a `cache` option", async () => {
    const api = installFakeSummarizer({ summary: "Fresh." });
    await summarize({ language: "en", input: "Some article body." });
    await summarize({ language: "en", input: "Some article body." });
    expect(api.create).toHaveBeenCalled();
  });

  it("returns a cached value without invoking the model", async () => {
    const api = installFakeSummarizer();
    const cache = inMemoryCache();
    cache.set("en", "From cache.");
    const result = await summarize({
      language: "en",
      input: "irrelevant",
      cache,
      cacheKey: "en",
    });
    expect(result).toEqual({ output: "From cache.", cached: true });
    expect(api.create).not.toHaveBeenCalled();
  });

  it("does not collide cache entries when input differs on the same route and language", async () => {
    let calls = 0;
    const api = installFakeSummarizer();
    api.create.mockImplementation(async () => ({
      summarize: vi.fn(async () => `Summary ${++calls}.`),
    }));
    const cache = inMemoryCache();

    const first = await summarize({
      language: "en",
      input: "First article body.",
      cache,
    });
    const second = await summarize({
      language: "en",
      input: "Second article body.",
      cache,
    });

    expect(first).toEqual({ output: "Summary 1.", cached: false });
    expect(second).toEqual({ output: "Summary 2.", cached: false });
  });

  it("does not collide cache entries when summary option shape differs", async () => {
    let calls = 0;
    const api = installFakeSummarizer();
    api.create.mockImplementation(async () => ({
      summarize: vi.fn(async () => `Summary ${++calls}.`),
    }));
    const cache = inMemoryCache();

    const first = await summarize({
      language: "en",
      input: "Article body.",
      type: "headline",
      length: "short",
      format: "plain-text",
      preference: "speed",
      sharedContext: "For executives.",
      cache,
    });
    const second = await summarize({
      language: "en",
      input: "Article body.",
      type: "key-points",
      length: "long",
      format: "markdown",
      preference: "capability",
      sharedContext: "For students.",
      cache,
    });

    expect(first).toEqual({ output: "Summary 1.", cached: false });
    expect(second).toEqual({ output: "Summary 2.", cached: false });
  });

  it("does not collide cache entries when supportedLanguages changes language hints", async () => {
    let calls = 0;
    const api = installFakeSummarizer();
    api.create.mockImplementation(async () => ({
      summarize: vi.fn(async () => `Summary ${++calls}.`),
    }));
    const cache = inMemoryCache();

    const first = await summarize({
      language: "pt-BR",
      supportedLanguages: ["pt"],
      input: "Article body.",
      cache,
    });
    const second = await summarize({
      language: "pt-BR",
      supportedLanguages: ["en"],
      input: "Article body.",
      cache,
    });

    expect(first).toEqual({ output: "Summary 1.", cached: false });
    expect(second).toEqual({ output: "Summary 2.", cached: false });
  });

  it("does not fragment cache entries for normalized supported language lists", async () => {
    let calls = 0;
    const api = installFakeSummarizer();
    api.create.mockImplementation(async () => ({
      summarize: vi.fn(async () => `Summary ${++calls}.`),
    }));
    const cache = inMemoryCache();

    const first = await summarize({
      language: "pt-BR",
      supportedLanguages: ["pt-BR"],
      input: "Article body.",
      cache,
    });
    const second = await summarize({
      language: "pt-BR",
      supportedLanguages: ["pt"],
      input: "Article body.",
      cache,
    });

    expect(first).toEqual({ output: "Summary 1.", cached: false });
    expect(second).toEqual({ output: "Summary 1.", cached: true });
  });

  it("does not fragment cache entries for unsupported language hint lists", async () => {
    let calls = 0;
    const api = installFakeSummarizer();
    api.create.mockImplementation(async () => ({
      summarize: vi.fn(async () => `Summary ${++calls}.`),
    }));
    const cache = inMemoryCache();

    const first = await summarize({
      language: "pt-BR",
      supportedLanguages: ["en"],
      input: "Article body.",
      cache,
    });
    const second = await summarize({
      language: "pt-BR",
      supportedLanguages: ["ja"],
      input: "Article body.",
      cache,
    });

    expect(first).toEqual({ output: "Summary 1.", cached: false });
    expect(second).toEqual({ output: "Summary 1.", cached: true });
  });

  it("writes successful summaries to the cache", async () => {
    installFakeSummarizer({ summary: "Fresh." });
    const cache = inMemoryCache();
    await summarize({
      language: "en",
      input: "body",
      cache,
      cacheKey: "k",
    });
    expect(cache.get("k")).toBe("Fresh.");
  });

  it("throws SummarizerUnavailableError when availability is 'unavailable'", async () => {
    installFakeSummarizer({ availability: "unavailable" });
    await expect(
      summarize({
        language: "en",
        input: "body",
        cache: inMemoryCache(),
      }),
    ).rejects.toBeInstanceOf(SummarizerUnavailableError);
  });

  it("does not create a session when availability is 'unavailable'", async () => {
    const api = installFakeSummarizer({ availability: "unavailable" });
    api.create.mockRejectedValue(new Error("create should not be called"));

    await expect(
      summarize({
        language: "en",
        input: "body",
        cache: inMemoryCache(),
      }),
    ).rejects.toBeInstanceOf(SummarizerUnavailableError);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("omits language hints for unsupported languages", async () => {
    const api = installFakeSummarizer({ summary: "ok" });
    await summarize({
      language: "pt",
      input: "olá",
      cache: inMemoryCache(),
    });
    const createOpts = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createOpts).not.toHaveProperty("expectedInputLanguages");
    expect(createOpts).not.toHaveProperty("outputLanguage");
  });

  it("includes language hints for supported languages", async () => {
    const api = installFakeSummarizer({ summary: "ok" });
    await summarize({
      language: "en",
      input: "hi",
      cache: inMemoryCache(),
    });
    const createOpts = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createOpts.expectedInputLanguages).toEqual(["en"]);
    expect(createOpts.outputLanguage).toBe("en");
  });

  it("returns null output when input is empty", async () => {
    installFakeSummarizer();
    const result = await summarize({
      language: "en",
      input: "",
      cache: inMemoryCache(),
    });
    expect(result).toEqual({ output: null, cached: false });
  });

  it("preserves sentence punctuation in the cleaned output", async () => {
    installFakeSummarizer({ summary: "Concise TL;DR." });
    const result = await summarize({
      language: "en",
      input: "Body about a thing.",
      cache: inMemoryCache(),
    });
    expect(result.output).toBe("Concise TL;DR.");
  });

  it("respects an aborted signal", async () => {
    installFakeSummarizer({ summary: "..." });
    const controller = new AbortController();
    controller.abort();
    await expect(
      summarize({
        language: "en",
        input: "body",
        cache: inMemoryCache(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("forwards top-level type/length/format/preference to create()", async () => {
    const api = installFakeSummarizer({ summary: "ok" });
    await summarize({
      language: "en",
      input: "body",
      type: "headline",
      length: "short",
      format: "markdown",
      preference: "capability",
    });
    const createOpts = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createOpts.type).toBe("headline");
    expect(createOpts.length).toBe("short");
    expect(createOpts.format).toBe("markdown");
    expect(createOpts.preference).toBe("capability");
  });

  it("defaults preference to 'auto' when omitted", async () => {
    const api = installFakeSummarizer({ summary: "ok" });
    await summarize({ language: "en", input: "body" });
    const createOpts = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createOpts.preference).toBe("auto");
  });

  it("forwards preference to the availability() probe", async () => {
    const api = installFakeSummarizer({ summary: "ok" });
    await summarize({ language: "en", input: "body", preference: "speed" });
    const availabilityOpts = api.availability.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(availabilityOpts.preference).toBe("speed");
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
      const api = installFakeSummarizer({ summary: "Stored." });
      const first = await summarize({
        language: "en",
        input: "body",
        cache: "session",
        cacheKey: "k",
      });
      expect(first).toEqual({ output: "Stored.", cached: false });
      expect(storage.setItem).toHaveBeenCalledWith("summarizer:k", "Stored.");

      const createsAfterFirst = api.create.mock.calls.length;
      const second = await summarize({
        language: "en",
        input: "body",
        cache: "session",
        cacheKey: "k",
      });
      expect(second).toEqual({ output: "Stored.", cached: true });
      expect(api.create).toHaveBeenCalledTimes(createsAfterFirst);
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
      const api = installFakeSummarizer({ summary: "Stored." });
      const first = await summarize({
        language: "en",
        input: "body",
        cache: "local",
        cacheKey: "k",
      });
      expect(first).toEqual({ output: "Stored.", cached: false });
      expect(storage.setItem).toHaveBeenCalledWith("summarizer:k", "Stored.");

      const createsAfterFirst = api.create.mock.calls.length;
      const second = await summarize({
        language: "en",
        input: "body",
        cache: "local",
        cacheKey: "k",
      });
      expect(second).toEqual({ output: "Stored.", cached: true });
      expect(api.create).toHaveBeenCalledTimes(createsAfterFirst);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("aborts without writing the cache", async () => {
    installFakeSummarizer({ summary: "..." });
    const cache = { get: vi.fn(() => null), set: vi.fn() };
    const controller = new AbortController();
    controller.abort();
    await expect(
      summarize({
        language: "en",
        input: "body",
        cache,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("aborts a streaming summarize without writing the cache", async () => {
    let resolveGate: () => void = () => {};
    const gate = new Promise<void>((r) => {
      resolveGate = r;
    });
    const api: FakeApi = {
      availability: vi.fn(async () => "available"),
      create: vi.fn(async () => ({
        summarize: vi.fn(),
        summarizeStreaming: async function* () {
          yield "a";
          await gate;
          yield "b";
        },
      })),
    };
    (globalThis as { Summarizer?: FakeApi }).Summarizer = api;

    const controller = new AbortController();
    const cache = { get: vi.fn(() => null), set: vi.fn() };
    const updates: string[] = [];
    const p = summarize({
      language: "en",
      input: "body",
      cache,
      signal: controller.signal,
      onUpdate: (c) => updates.push(c),
    });
    for (let i = 0; i < 50 && updates.length === 0; i++) {
      await Promise.resolve();
    }
    expect(updates).toEqual(["a"]);
    controller.abort();
    resolveGate();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(cache.set).not.toHaveBeenCalled();
  });
});
