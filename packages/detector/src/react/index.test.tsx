import { act, renderHook, waitFor } from "@testing-library/react";
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
    const { result } = renderHook(() => useDetector({ input: "hi" }));
    expect(result.current.status).toBe("unavailable");
  });

  it("stays in 'idle' when input is empty", () => {
    installFakeDetector();
    const { result } = renderHook(() => useDetector({ input: "  " }));
    expect(result.current.status).toBe("idle");
  });

  it("transitions idle → loading → done", async () => {
    installFakeDetector({
      results: [{ detectedLanguage: "pt", confidence: 0.93 }],
    });
    const { result } = renderHook(() => useDetector({ input: "Olá, mundo" }));

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output?.language).toBe("pt");
    expect(result.current.output?.confidence).toBeCloseTo(0.93);
    expect(result.current.error).toBeNull();
  });

  it("re-runs when input changes", async () => {
    const api = installFakeDetector({
      results: [{ detectedLanguage: "en", confidence: 0.9 }],
    });
    const { result, rerender } = renderHook(
      ({ input }: { input: string }) => useDetector({ input }),
      { initialProps: { input: "hello" } },
    );
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(api.detectSpy).toHaveBeenCalledTimes(1);

    rerender({ input: "hola" });
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
      useDetector({ input: "こんにちは", cache, cacheKey: "k" }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output?.language).toBe("ja");
    expect(result.current.fromCache).toBe(true);
  });

  it("respects minConfidence and reports null output when below the threshold", async () => {
    installFakeDetector({
      results: [{ detectedLanguage: "und", confidence: 0.3 }],
    });
    const { result } = renderHook(() =>
      useDetector({ input: "??", minConfidence: 0.9 }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBeNull();
  });

  it("discards a stale request when input changes (cleanup aborts the prior run)", async () => {
    type FakeResults = Array<{
      detectedLanguage: string;
      confidence: number;
    }>;
    const resolvers: Array<(out: FakeResults) => void> = [];
    const methodSpy = vi.fn(
      () =>
        new Promise<FakeResults>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const api = {
      availability: vi.fn(async () => "available"),
      create: vi.fn(async () => ({ detect: methodSpy })),
    };
    (globalThis as { LanguageDetector?: typeof api }).LanguageDetector = api;

    const { result, rerender } = renderHook(
      ({ input }: { input: string }) => useDetector({ input }),
      { initialProps: { input: "A" } },
    );
    await waitFor(() => expect(resolvers).toHaveLength(1));

    rerender({ input: "B" });
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => {
      resolvers[0]?.([{ detectedLanguage: "stale-A", confidence: 0.9 }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.output?.language).not.toBe("stale-A");

    await act(async () => {
      resolvers[1]?.([{ detectedLanguage: "fresh-B", confidence: 0.9 }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output?.language).toBe("fresh-B");
  });
});
