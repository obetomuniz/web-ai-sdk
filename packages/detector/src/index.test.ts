import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  type DetectionCache,
  DetectorUnavailableError,
  detect,
  isAvailable,
} from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  detectSpy: ReturnType<typeof vi.fn>;
}

const installFakeDetector = (
  opts: {
    results?: Array<{ detectedLanguage: string; confidence: number }>;
    availability?: "available" | "unavailable";
  } = {},
): FakeApi => {
  const results = opts.results ?? [
    { detectedLanguage: "en", confidence: 0.95 },
    { detectedLanguage: "es", confidence: 0.04 },
  ];
  const availability = opts.availability ?? "available";

  const detectSpy = vi.fn(async () => results);
  const session = { detect: detectSpy };

  const api = {
    availability: vi.fn(async () => availability),
    create: vi.fn(async () => session),
    detectSpy,
  };
  (globalThis as { LanguageDetector?: unknown }).LanguageDetector = api;
  return api as FakeApi;
};

const removeFakeDetector = () => {
  (globalThis as { LanguageDetector?: unknown }).LanguageDetector = undefined;
};

const inMemoryCache = (): DetectionCache => {
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
  removeFakeDetector();
});

describe("isAvailable", () => {
  it("is false when the global is missing", () => {
    expect(isAvailable()).toBe(false);
  });

  it("is true when the global is present", () => {
    installFakeDetector();
    expect(isAvailable()).toBe(true);
  });
});

describe("detect", () => {
  it("throws DetectorUnavailableError when the global is missing", async () => {
    await expect(detect({ input: "hello" })).rejects.toBeInstanceOf(
      DetectorUnavailableError,
    );
  });

  it("returns null output when input is empty", async () => {
    installFakeDetector();
    const result = await detect({ input: "   " });
    expect(result).toEqual({ output: null, cached: false });
  });

  it("returns the top result with full sorted list", async () => {
    installFakeDetector({
      results: [
        { detectedLanguage: "pt", confidence: 0.97 },
        { detectedLanguage: "es", confidence: 0.02 },
      ],
    });
    const result = await detect({ input: "Olá, mundo" });
    expect(result.output?.language).toBe("pt");
    expect(result.output?.confidence).toBeCloseTo(0.97);
    expect(result.output?.all).toHaveLength(2);
    expect(result.cached).toBe(false);
  });

  it("re-sorts results defensively when the API returns out of order", async () => {
    installFakeDetector({
      results: [
        { detectedLanguage: "es", confidence: 0.02 },
        { detectedLanguage: "pt", confidence: 0.97 },
      ],
    });
    const result = await detect({ input: "Olá, mundo" });
    expect(result.output?.language).toBe("pt");
    expect(result.output?.all[0]?.detectedLanguage).toBe("pt");
  });

  it("returns null output when top confidence is below minConfidence", async () => {
    installFakeDetector({
      results: [
        { detectedLanguage: "und", confidence: 0.4 },
        { detectedLanguage: "en", confidence: 0.35 },
      ],
    });
    const result = await detect({ input: "??", minConfidence: 0.8 });
    expect(result.output).toBeNull();
  });

  it("does not cache by default; same call hits the model twice without a `cache` option", async () => {
    const api = installFakeDetector();
    await detect({ input: "hello" });
    await detect({ input: "hello" });
    expect(api.detectSpy).toHaveBeenCalledTimes(2);
  });

  it("returns a cached value without invoking the model", async () => {
    const api = installFakeDetector();
    const cache = inMemoryCache();
    cache.set(
      "k",
      JSON.stringify([{ detectedLanguage: "fr", confidence: 0.99 }]),
    );
    const result = await detect({
      input: "irrelevant",
      cache,
      cacheKey: "k",
    });
    expect(result.output?.language).toBe("fr");
    expect(result.cached).toBe(true);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("writes successful results to the cache", async () => {
    installFakeDetector({
      results: [{ detectedLanguage: "ja", confidence: 0.9 }],
    });
    const cache = inMemoryCache();
    await detect({ input: "こんにちは", cache, cacheKey: "k" });
    expect(cache.get("k")).toContain("ja");
  });

  it("forwards expectedInputLanguages to create()", async () => {
    const api = installFakeDetector();
    await detect({ input: "hi", expectedInputLanguages: ["en", "es"] });
    const createArgs = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createArgs.expectedInputLanguages).toEqual(["en", "es"]);
  });

  it("reuses sessions across same-shape calls", async () => {
    const api = installFakeDetector();
    await detect({ input: "a", expectedInputLanguages: ["en"] });
    await detect({ input: "b", expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it("creates a new session when expectedInputLanguages differs", async () => {
    const api = installFakeDetector();
    await detect({ input: "a", expectedInputLanguages: ["en"] });
    await detect({ input: "b", expectedInputLanguages: ["es"] });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("throws DetectorUnavailableError when availability is 'unavailable'", async () => {
    installFakeDetector({ availability: "unavailable" });
    await expect(detect({ input: "hi" })).rejects.toBeInstanceOf(
      DetectorUnavailableError,
    );
  });

  it("respects an aborted signal", async () => {
    installFakeDetector();
    const controller = new AbortController();
    controller.abort();
    await expect(
      detect({ input: "hi", signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
