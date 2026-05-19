import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "../api.js";
import { useDetector } from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  detectSpy: ReturnType<typeof vi.fn>;
}

const installFakeDetector = (
  opts: {
    results?: Array<{ detectedLanguage: string; confidence: number }>;
  } = {},
): FakeApi => {
  const results = opts.results ?? [
    { detectedLanguage: "en", confidence: 0.95 },
  ];
  const detectSpy = vi.fn(async () => results);
  const session = { detect: detectSpy };
  const api = {
    availability: vi.fn(async () => "available"),
    create: vi.fn(async () => session),
    detectSpy,
  };
  (globalThis as { LanguageDetector?: unknown }).LanguageDetector = api;
  return api as FakeApi;
};

const removeFakeDetector = () => {
  (globalThis as { LanguageDetector?: unknown }).LanguageDetector = undefined;
};

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  removeFakeDetector();
});

describe("useDetector", () => {
  it("starts in 'unavailable' when the API is missing", () => {
    const { result } = renderHook(() => useDetector({ text: "hi" }));
    expect(result.current.status).toBe("unavailable");
  });

  it("stays in 'pending' when text is empty", () => {
    installFakeDetector();
    const { result } = renderHook(() => useDetector({ text: "  " }));
    expect(result.current.status).toBe("pending");
  });

  it("transitions pending → loading → done", async () => {
    installFakeDetector({
      results: [{ detectedLanguage: "pt", confidence: 0.93 }],
    });
    const { result } = renderHook(() => useDetector({ text: "Olá, mundo" }));

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.language).toBe("pt");
    expect(result.current.confidence).toBeCloseTo(0.93);
    expect(result.current.error).toBeNull();
  });

  it("re-runs when text changes", async () => {
    const api = installFakeDetector({
      results: [{ detectedLanguage: "en", confidence: 0.9 }],
    });
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) => useDetector({ text }),
      { initialProps: { text: "hello" } },
    );
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(api.detectSpy).toHaveBeenCalledTimes(1);

    rerender({ text: "hola" });
    await waitFor(() => expect(api.detectSpy).toHaveBeenCalledTimes(2));
  });

  it("sets fromCache=true when the cache serves the result", async () => {
    installFakeDetector();
    const store = new Map<string, string>();
    store.set(
      "k",
      JSON.stringify([{ detectedLanguage: "ja", confidence: 0.99 }]),
    );
    const cache = {
      get: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    const { result } = renderHook(() =>
      useDetector({ text: "こんにちは", cache, cacheKey: "k" }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.language).toBe("ja");
    expect(result.current.fromCache).toBe(true);
  });

  it("respects minConfidence and reports null when below the threshold", async () => {
    installFakeDetector({
      results: [{ detectedLanguage: "und", confidence: 0.3 }],
    });
    const { result } = renderHook(() =>
      useDetector({ text: "??", minConfidence: 0.9 }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.language).toBeNull();
    expect(result.current.confidence).toBe(0);
  });
});
