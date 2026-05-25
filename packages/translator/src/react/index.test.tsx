import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "../api.js";
import { useTranslator } from "./index.js";

const installFakeTranslator = (
  translateImpl?: (text: string) => Promise<string>,
) => {
  const impl = translateImpl ?? (async (text: string) => `[t]${text}`);
  const api = {
    availability: vi.fn(async () => "available" as const),
    create: vi.fn(async () => ({
      translate: vi.fn(impl),
    })),
  };
  (globalThis as { Translator?: typeof api }).Translator = api;
  return api;
};

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  (globalThis as { Translator?: unknown }).Translator = undefined;
});

describe("useTranslator", () => {
  it("starts as 'unavailable' when the global is missing", () => {
    const { result } = renderHook(() =>
      useTranslator({
        input: "Olá",
        sourceLanguage: "pt",
        targetLanguage: "en",
      }),
    );
    expect(result.current.status).toBe("unavailable");
  });

  it("stays in 'idle' when input is empty", () => {
    installFakeTranslator();
    const { result } = renderHook(() =>
      useTranslator({
        input: "  ",
        sourceLanguage: "pt",
        targetLanguage: "en",
      }),
    );
    expect(result.current.status).toBe("idle");
  });

  it("transitions idle → loading → done", async () => {
    installFakeTranslator(async (text) => text.replace("Olá", "Hello"));
    const { result } = renderHook(() =>
      useTranslator({
        input: "Olá mundo",
        sourceLanguage: "pt",
        targetLanguage: "en",
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBe("Hello mundo");
    expect(result.current.error).toBeNull();
  });

  it("re-runs when input changes", async () => {
    const api = installFakeTranslator();
    const { result, rerender } = renderHook(
      ({ input }: { input: string }) =>
        useTranslator({ input, sourceLanguage: "pt", targetLanguage: "en" }),
      { initialProps: { input: "Olá" } },
    );
    await waitFor(() => expect(result.current.status).toBe("done"));
    const innerSession = await api.create.mock.results[0]?.value;

    rerender({ input: "Tchau" });
    await waitFor(() =>
      expect(innerSession.translate).toHaveBeenCalledTimes(2),
    );
  });

  it("sets fromCache=true when the cache serves the result", async () => {
    installFakeTranslator();
    const store = new Map<string, string>();
    store.set("k", "From cache.");
    const cache = {
      get: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    const { result } = renderHook(() =>
      useTranslator({
        input: "Olá",
        sourceLanguage: "pt",
        targetLanguage: "en",
        cache,
        cacheKey: "k",
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBe("From cache.");
    expect(result.current.fromCache).toBe(true);
  });

  it("idles when source and target match", async () => {
    installFakeTranslator();
    const { result } = renderHook(() =>
      useTranslator({
        input: "Hello",
        sourceLanguage: "en",
        targetLanguage: "en",
      }),
    );
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBeNull();
  });
});
