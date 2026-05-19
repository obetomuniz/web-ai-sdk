import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  type DetectionCache,
  DetectorUnavailableError,
  detect,
  isDetectorAvailable,
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

describe("isDetectorAvailable", () => {
  it("is false when the global is missing", () => {
    expect(isDetectorAvailable()).toBe(false);
  });

  it("is true when the global is present", () => {
    installFakeDetector();
    expect(isDetectorAvailable()).toBe(true);
  });
});

describe("detect", () => {
  it("throws DetectorUnavailableError when the global is missing", async () => {
    await expect(detect({ text: "hello" })).rejects.toBeInstanceOf(
      DetectorUnavailableError,
    );
  });

  it("returns null language when input is empty", async () => {
    installFakeDetector();
    const result = await detect({ text: "   " });
    expect(result).toEqual({
      language: null,
      confidence: 0,
      all: [],
      cached: false,
    });
  });

  it("returns the top result with full sorted list", async () => {
    installFakeDetector({
      results: [
        { detectedLanguage: "pt", confidence: 0.97 },
        { detectedLanguage: "es", confidence: 0.02 },
      ],
    });
    const result = await detect({ text: "Olá, mundo" });
    expect(result.language).toBe("pt");
    expect(result.confidence).toBeCloseTo(0.97);
    expect(result.all).toHaveLength(2);
    expect(result.cached).toBe(false);
  });

  it("re-sorts results defensively when the API returns out of order", async () => {
    installFakeDetector({
      results: [
        { detectedLanguage: "es", confidence: 0.02 },
        { detectedLanguage: "pt", confidence: 0.97 },
      ],
    });
    const result = await detect({ text: "Olá, mundo" });
    expect(result.language).toBe("pt");
    expect(result.all[0]?.detectedLanguage).toBe("pt");
  });

  it("returns null language when top confidence is below minConfidence", async () => {
    installFakeDetector({
      results: [
        { detectedLanguage: "und", confidence: 0.4 },
        { detectedLanguage: "en", confidence: 0.35 },
      ],
    });
    const result = await detect({ text: "??", minConfidence: 0.8 });
    expect(result.language).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.all).toHaveLength(2);
  });

  it("does not cache by default; same call hits the model twice without a `cache` option", async () => {
    const api = installFakeDetector();
    await detect({ text: "hello" });
    await detect({ text: "hello" });
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
      text: "irrelevant",
      cache,
      cacheKey: "k",
    });
    expect(result.language).toBe("fr");
    expect(result.cached).toBe(true);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("writes successful results to the cache", async () => {
    installFakeDetector({
      results: [{ detectedLanguage: "ja", confidence: 0.9 }],
    });
    const cache = inMemoryCache();
    await detect({ text: "こんにちは", cache, cacheKey: "k" });
    expect(cache.get("k")).toContain("ja");
  });

  it("forwards expectedInputLanguages to create()", async () => {
    const api = installFakeDetector();
    await detect({ text: "hi", expectedInputLanguages: ["en", "es"] });
    const createArgs = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createArgs.expectedInputLanguages).toEqual(["en", "es"]);
  });

  it("reuses sessions across same-shape calls", async () => {
    const api = installFakeDetector();
    await detect({ text: "a", expectedInputLanguages: ["en"] });
    await detect({ text: "b", expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it("creates a new session when expectedInputLanguages differs", async () => {
    const api = installFakeDetector();
    await detect({ text: "a", expectedInputLanguages: ["en"] });
    await detect({ text: "b", expectedInputLanguages: ["es"] });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("throws DetectorUnavailableError when availability is 'unavailable'", async () => {
    installFakeDetector({ availability: "unavailable" });
    await expect(detect({ text: "hi" })).rejects.toBeInstanceOf(
      DetectorUnavailableError,
    );
  });

  it("respects an aborted signal", async () => {
    installFakeDetector();
    const controller = new AbortController();
    controller.abort();
    await expect(
      detect({ text: "hi", signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
