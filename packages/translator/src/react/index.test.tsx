import { act, renderHook } from "@testing-library/react";
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
  document.body.innerHTML = "";
});

afterEach(() => {
  (globalThis as { Translator?: unknown }).Translator = undefined;
});

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
};

describe("useTranslator", () => {
  it("starts as 'unavailable' when the global is missing", () => {
    const { result } = renderHook(() =>
      useTranslator({ sourceLanguage: "pt", targetLanguage: "en" }),
    );
    expect(result.current.state).toBe("unavailable");
  });

  it("starts as 'idle' when the API is available", () => {
    installFakeTranslator();
    const { result } = renderHook(() =>
      useTranslator({ sourceLanguage: "pt", targetLanguage: "en" }),
    );
    expect(result.current.state).toBe("idle");
  });

  it("starts as 'unavailable' when source and target match", () => {
    installFakeTranslator();
    const { result } = renderHook(() =>
      useTranslator({ sourceLanguage: "en", targetLanguage: "en" }),
    );
    expect(result.current.state).toBe("unavailable");
  });

  it("transitions through working → translated when translate() resolves", async () => {
    installFakeTranslator(async (text) => text.replace("Olá", "Hello"));
    document.body.innerHTML =
      "<article data-translate-root><p>Olá mundo</p></article>";

    const { result } = renderHook(() =>
      useTranslator({ sourceLanguage: "pt", targetLanguage: "en" }),
    );

    await act(async () => {
      result.current.translate();
      await flush();
    });

    expect(result.current.state).toBe("translated");
    expect(document.querySelector("p")?.textContent).toBe("Hello mundo");
  });

  it("restore() returns blocks to their original children and resets to idle", async () => {
    installFakeTranslator(async (text) => text.replace("Olá", "Hello"));
    document.body.innerHTML =
      "<article data-translate-root><p>Olá mundo</p></article>";

    const { result } = renderHook(() =>
      useTranslator({ sourceLanguage: "pt", targetLanguage: "en" }),
    );

    await act(async () => {
      result.current.translate();
      await flush();
    });
    expect(result.current.state).toBe("translated");

    act(() => {
      result.current.restore();
    });
    expect(result.current.state).toBe("idle");
    expect(document.querySelector("p")?.textContent).toBe("Olá mundo");
  });

  it("cancels in-flight translation on unmount without throwing", async () => {
    installFakeTranslator(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve("..."), 50);
        }),
    );
    document.body.innerHTML =
      "<article data-translate-root><p>texto</p></article>";

    const { result, unmount } = renderHook(() =>
      useTranslator({ sourceLanguage: "pt", targetLanguage: "en" }),
    );

    act(() => {
      result.current.translate();
    });
    expect(() => unmount()).not.toThrow();
  });
});
