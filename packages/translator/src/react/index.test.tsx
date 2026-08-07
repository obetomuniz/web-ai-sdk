import { act, renderHook, waitFor } from "@testing-library/react";
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

  it("discards a stale request when input changes (cleanup aborts the prior run)", async () => {
    const resolvers: Array<(out: string) => void> = [];
    const methodSpy = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const api = {
      availability: vi.fn(async () => "available" as const),
      create: vi.fn(async () => ({ translate: methodSpy })),
    };
    (globalThis as { Translator?: typeof api }).Translator = api;

    const { result, rerender } = renderHook(
      ({ input }: { input: string }) =>
        useTranslator({ input, sourceLanguage: "pt", targetLanguage: "en" }),
      { initialProps: { input: "A" } },
    );
    await waitFor(() => expect(resolvers).toHaveLength(1));

    rerender({ input: "B" });
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => {
      resolvers[0]?.("stale-A");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.output).not.toBe("stale-A");

    await act(async () => {
      resolvers[1]?.("fresh-B");
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBe("fresh-B");
  });

  interface FakeStream {
    input: string;
    emit(chunk: string): void;
    close(): void;
    cancelled: boolean;
  }

  const installStreamingTranslator = () => {
    const streams: FakeStream[] = [];
    const translateStreaming = vi.fn((input: string) => {
      const handle: FakeStream = {
        input,
        emit: () => {},
        close: () => {},
        cancelled: false,
      };
      const stream = new ReadableStream<string>({
        start(controller) {
          handle.emit = (chunk) => controller.enqueue(chunk);
          handle.close = () => controller.close();
        },
        cancel() {
          handle.cancelled = true;
        },
      });
      streams.push(handle);
      return stream;
    });
    const api = {
      availability: vi.fn(async () => "available" as const),
      create: vi.fn(async () => ({
        translate: vi.fn(async (text: string) => `[t]${text}`),
        translateStreaming,
      })),
    };
    (globalThis as { Translator?: typeof api }).Translator = api;
    return { api, streams };
  };

  it("reports 'streaming' with cumulative output, then 'done'", async () => {
    const { streams } = installStreamingTranslator();
    const { result } = renderHook(() =>
      useTranslator({
        input: "Hello world",
        sourceLanguage: "en",
        targetLanguage: "pt",
      }),
    );
    await waitFor(() => expect(streams).toHaveLength(1));
    expect(result.current.status).toBe("loading");

    await act(async () => {
      streams[0]?.emit("Olá");
    });
    await waitFor(() => expect(result.current.status).toBe("streaming"));
    expect(result.current.output).toBe("Olá");

    await act(async () => {
      streams[0]?.emit(" mundo");
    });
    await waitFor(() => expect(result.current.output).toBe("Olá mundo"));
    expect(result.current.status).toBe("streaming");

    await act(async () => {
      streams[0]?.close();
    });
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBe("Olá mundo");
    expect(result.current.error).toBeNull();
  });

  it("cancels an in-flight stream when input changes and suppresses stale updates", async () => {
    const { streams } = installStreamingTranslator();
    const { result, rerender } = renderHook(
      ({ input }: { input: string }) =>
        useTranslator({ input, sourceLanguage: "en", targetLanguage: "pt" }),
      { initialProps: { input: "A" } },
    );
    await waitFor(() => expect(streams).toHaveLength(1));
    await act(async () => {
      streams[0]?.emit("partial-A");
    });
    await waitFor(() => expect(result.current.output).toBe("partial-A"));

    rerender({ input: "B" });
    await waitFor(() => expect(streams).toHaveLength(2));
    await waitFor(() => expect(streams[0]?.cancelled).toBe(true));

    await act(async () => {
      streams[1]?.emit("fresh-B");
      streams[1]?.close();
    });
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBe("fresh-B");
  });

  it("cancels the stream on unmount", async () => {
    const { streams } = installStreamingTranslator();
    const { unmount } = renderHook(() =>
      useTranslator({
        input: "Hello",
        sourceLanguage: "en",
        targetLanguage: "pt",
      }),
    );
    await waitFor(() => expect(streams).toHaveLength(1));
    await act(async () => {
      streams[0]?.emit("Olá");
    });

    unmount();
    await waitFor(() => expect(streams[0]?.cancelled).toBe(true));
  });
});
