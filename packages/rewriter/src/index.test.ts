import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  isAvailable,
  type RewriteCache,
  RewriterUnavailableError,
  rewrite,
} from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

const installFakeRewriter = (
  opts: {
    output?: string;
    chunks?: string[];
    availability?: "available" | "unavailable";
  } = {},
): FakeApi => {
  const output = opts.output ?? "Rewritten.";
  const chunks = opts.chunks;
  const availability = opts.availability ?? "available";

  const rewriter = chunks
    ? {
        rewrite: vi.fn(async () => output),
        rewriteStreaming: async function* (_input: string) {
          for (const c of chunks) yield c;
        },
      }
    : {
        rewrite: vi.fn(async () => output),
      };

  const api: FakeApi = {
    availability: vi.fn(async () => availability),
    create: vi.fn(async () => rewriter),
  };
  (globalThis as { Rewriter?: FakeApi }).Rewriter = api;
  return api;
};

const removeFakeRewriter = () => {
  (globalThis as { Rewriter?: unknown }).Rewriter = undefined;
};

const inMemoryCache = (): RewriteCache => {
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
  removeFakeRewriter();
});

describe("isAvailable", () => {
  it("is false when the global is missing", () => {
    expect(isAvailable()).toBe(false);
  });

  it("is true when the global is present", () => {
    installFakeRewriter();
    expect(isAvailable()).toBe(true);
  });
});

describe("rewrite", () => {
  it("throws RewriterUnavailableError when the global is missing", async () => {
    await expect(rewrite({ input: "Make it shorter." })).rejects.toBeInstanceOf(
      RewriterUnavailableError,
    );
  });

  it("returns a one-shot result when streaming is unavailable", async () => {
    installFakeRewriter({ output: "Shorter version." });
    const result = await rewrite({
      input: "A rather long-winded sentence that could be tightened up.",
      length: "shorter",
      cache: inMemoryCache(),
    });
    expect(result).toEqual({ output: "Shorter version.", cached: false });
  });

  it("streams delta chunks and returns the trimmed final text", async () => {
    installFakeRewriter({ chunks: ["More", " formal", " "] });
    const chunks: string[] = [];
    const result = await rewrite({
      input: "hey what's up",
      tone: "more-formal",
      cache: inMemoryCache(),
      onUpdate: (c) => chunks.push(c),
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(result.output).toBe("More formal");
  });

  it("handles cumulative chunks without double-concatenation", async () => {
    installFakeRewriter({ chunks: ["More", "More formal", "More formal "] });
    const result = await rewrite({
      input: "hey",
      cache: inMemoryCache(),
    });
    expect(result.output).toBe("More formal");
  });

  it("does not cache by default", async () => {
    const api = installFakeRewriter({ output: "Fresh." });
    await rewrite({ input: "Same text." });
    await rewrite({ input: "Same text." });
    expect(api.create).toHaveBeenCalled();
  });

  it("returns a cached value without invoking the model", async () => {
    const api = installFakeRewriter();
    const cache = inMemoryCache();
    cache.set("k", "From cache.");
    const result = await rewrite({
      input: "irrelevant",
      cache,
      cacheKey: "k",
    });
    expect(result).toEqual({ output: "From cache.", cached: true });
    expect(api.create).not.toHaveBeenCalled();
  });

  it("does not collide cache entries when sharedContext differs", async () => {
    let calls = 0;
    const api = installFakeRewriter();
    api.create.mockImplementation(async () => ({
      rewrite: vi.fn(async () => `Rewrite ${++calls}.`),
    }));
    const cache = inMemoryCache();

    const first = await rewrite({
      input: "Make this clearer.",
      sharedContext: "For customers.",
      cache,
    });
    const second = await rewrite({
      input: "Make this clearer.",
      sharedContext: "For investors.",
      cache,
    });

    expect(first).toEqual({ output: "Rewrite 1.", cached: false });
    expect(second).toEqual({ output: "Rewrite 2.", cached: false });
  });

  it("does not collide cache entries when supportedLanguages changes language hints", async () => {
    let calls = 0;
    const api = installFakeRewriter();
    api.create.mockImplementation(async () => ({
      rewrite: vi.fn(async () => `Rewrite ${++calls}.`),
    }));
    const cache = inMemoryCache();

    const first = await rewrite({
      input: "Make this clearer.",
      language: "pt-BR",
      supportedLanguages: ["pt"],
      cache,
    });
    const second = await rewrite({
      input: "Make this clearer.",
      language: "pt-BR",
      supportedLanguages: ["en"],
      cache,
    });

    expect(first).toEqual({ output: "Rewrite 1.", cached: false });
    expect(second).toEqual({ output: "Rewrite 2.", cached: false });
  });

  it("forwards per-call context to the underlying rewrite()", async () => {
    const api = installFakeRewriter({ output: "ok" });
    await rewrite({
      input: "Tighten this up.",
      context: "Audience is executives.",
    });
    const instance = await api.create.mock.results[0]?.value;
    expect(instance.rewrite).toHaveBeenCalledWith(
      "Tighten this up.",
      expect.objectContaining({ context: "Audience is executives." }),
    );
  });

  it("throws RewriterUnavailableError when availability is 'unavailable'", async () => {
    installFakeRewriter({ availability: "unavailable" });
    await expect(
      rewrite({ input: "text", cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(RewriterUnavailableError);
  });

  it("does not create a session when availability is 'unavailable'", async () => {
    const api = installFakeRewriter({ availability: "unavailable" });
    api.create.mockRejectedValue(new Error("create should not be called"));

    await expect(
      rewrite({ input: "text", cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(RewriterUnavailableError);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("forwards tone/format/length to create()", async () => {
    const api = installFakeRewriter({ output: "ok" });
    await rewrite({
      input: "text",
      tone: "more-casual",
      format: "plain-text",
      length: "longer",
    });
    const createOpts = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createOpts.tone).toBe("more-casual");
    expect(createOpts.format).toBe("plain-text");
    expect(createOpts.length).toBe("longer");
  });

  it("returns null output when input is empty", async () => {
    installFakeRewriter();
    const result = await rewrite({ input: "", cache: inMemoryCache() });
    expect(result).toEqual({ output: null, cached: false });
  });

  it("respects an aborted signal", async () => {
    installFakeRewriter({ output: "..." });
    const controller = new AbortController();
    controller.abort();
    await expect(
      rewrite({
        input: "text",
        cache: inMemoryCache(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
