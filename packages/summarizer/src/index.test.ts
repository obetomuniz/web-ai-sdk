import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  SummarizerUnavailableError,
  type SummaryCache,
  isSummarizerAvailable,
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

describe("isSummarizerAvailable", () => {
  it("is false when the global is missing", () => {
    expect(isSummarizerAvailable()).toBe(false);
  });

  it("is true when the global is present", () => {
    installFakeSummarizer();
    expect(isSummarizerAvailable()).toBe(true);
  });
});

describe("summarize", () => {
  it("throws SummarizerUnavailableError when the global is missing", async () => {
    await expect(
      summarize({ language: "en", text: "Hello." }),
    ).rejects.toBeInstanceOf(SummarizerUnavailableError);
  });

  it("returns a one-shot summary when streaming is unavailable", async () => {
    installFakeSummarizer({ summary: "Concise overview." });
    const result = await summarize({
      language: "en",
      text: "A long article body that the model summarizes.",
      cache: inMemoryCache(),
    });
    expect(result).toEqual({ summary: "Concise overview.", cached: false });
  });

  it("streams delta chunks (Chrome shape) and returns the cleaned final text", async () => {
    installFakeSummarizer({
      chunks: ['"Hello', " world", ' "'],
    });
    const chunks: string[] = [];
    const result = await summarize({
      language: "en",
      text: "Some article body.",
      cache: inMemoryCache(),
      onChunk: (c) => chunks.push(c),
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(result.summary).toBe("Hello world");
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
      text: "Some article body.",
      cache: inMemoryCache(),
      onChunk: (c) => chunks.push(c),
    });
    expect(result.summary).toBe("Hello world");
    expect(result.cached).toBe(false);
  });

  it("does not cache by default; same call hits the model twice without a `cache` option", async () => {
    const api = installFakeSummarizer({ summary: "Fresh." });
    await summarize({ language: "en", text: "Some article body." });
    await summarize({ language: "en", text: "Some article body." });
    // No cache passed: each call should create a session (or reuse, but
    // the underlying summarize() should be called twice).
    expect(api.create).toHaveBeenCalled();
  });

  it("returns a cached value without invoking the model", async () => {
    const api = installFakeSummarizer();
    const cache = inMemoryCache();
    cache.set("en", "From cache.");
    const result = await summarize({
      language: "en",
      text: "irrelevant",
      cache,
      cacheKey: "en",
    });
    expect(result).toEqual({ summary: "From cache.", cached: true });
    expect(api.create).not.toHaveBeenCalled();
  });

  it("writes successful summaries to the cache", async () => {
    installFakeSummarizer({ summary: "Fresh." });
    const cache = inMemoryCache();
    await summarize({
      language: "en",
      text: "body",
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
        text: "body",
        cache: inMemoryCache(),
      }),
    ).rejects.toBeInstanceOf(SummarizerUnavailableError);
  });

  it("omits language hints for unsupported languages", async () => {
    const api = installFakeSummarizer({ summary: "ok" });
    await summarize({
      language: "pt",
      text: "olá",
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
      text: "hi",
      cache: inMemoryCache(),
    });
    const createOpts = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createOpts.expectedInputLanguages).toEqual(["en"]);
    expect(createOpts.outputLanguage).toBe("en");
  });

  it("uses the article skeleton when no `text` is passed", async () => {
    installFakeSummarizer({ summary: "ok" });
    const article = document.createElement("article");
    article.innerHTML = `<h2>Big idea</h2>${"<p>Body with <strong>important phrase</strong>.</p>".repeat(20)}`;

    const result = await summarize({
      language: "en",
      article,
      title: "My Post",
      description: "A great description longer than the threshold here yes.",
      cache: inMemoryCache(),
    });
    expect(result.summary).toBe("ok");
  });

  it("returns null summary when neither text nor article is provided", async () => {
    installFakeSummarizer();
    const result = await summarize({
      language: "en",
      cache: inMemoryCache(),
    });
    expect(result).toEqual({ summary: null, cached: false });
  });

  it("respects an aborted signal", async () => {
    installFakeSummarizer({ summary: "..." });
    const controller = new AbortController();
    controller.abort();
    await expect(
      summarize({
        language: "en",
        text: "body",
        cache: inMemoryCache(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
