import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "../api.js";
import type { SummaryCache } from "../index.js";
import { useSummarizer } from "./index.js";

const installFakeSummarizer = (
  opts: {
    summary?: string;
    chunks?: string[];
    availability?: "available" | "unavailable";
  } = {},
) => {
  const summary = opts.summary ?? "Cached.";
  const chunks = opts.chunks;
  const availability = opts.availability ?? "available";

  const summarizer = chunks
    ? {
        summarize: vi.fn(async () => summary),
        summarizeStreaming: async function* () {
          for (const c of chunks) yield c;
        },
      }
    : { summarize: vi.fn(async () => summary) };

  const api = {
    availability: vi.fn(async () => availability),
    create: vi.fn(async () => summarizer),
  };
  (globalThis as { Summarizer?: typeof api }).Summarizer = api;
  return api;
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
  (globalThis as { Summarizer?: unknown }).Summarizer = undefined;
});

describe("useSummarizer", () => {
  it("starts as 'unavailable' when the global is missing", () => {
    const { result } = renderHook(() =>
      useSummarizer({ language: "en", input: "body" }),
    );
    expect(result.current.status).toBe("unavailable");
  });

  it("transitions to 'done' on a successful run", async () => {
    installFakeSummarizer({ summary: "Result." });
    const cache = inMemoryCache();
    const { result } = renderHook(() =>
      useSummarizer({ language: "en", input: "body", cache, cacheKey: "k" }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBe("Result.");
  });

  it("sets status to done, not unavailable, when the result is empty", async () => {
    installFakeSummarizer({ summary: "" });
    const cache = inMemoryCache();
    const { result } = renderHook(() =>
      useSummarizer({ language: "en", input: "body", cache, cacheKey: "k" }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("streams chunks to the consumer", async () => {
    installFakeSummarizer({ chunks: ["Hel", "lo", "."] });
    const cache = inMemoryCache();
    const { result } = renderHook(() =>
      useSummarizer({ language: "en", input: "body", cache, cacheKey: "k" }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBe("Hello.");
  });

  it("flips to fromCache=true when the cache hits", async () => {
    installFakeSummarizer();
    const cache = inMemoryCache();
    cache.set("k", "From cache.");
    const { result } = renderHook(() =>
      useSummarizer({ language: "en", input: "body", cache, cacheKey: "k" }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.fromCache).toBe(true);
    expect(result.current.output).toBe("From cache.");
  });

  it("dismiss() clears the summary and sets unavailable", async () => {
    installFakeSummarizer({ summary: "Result." });
    const cache = inMemoryCache();
    const { result } = renderHook(() =>
      useSummarizer({ language: "en", input: "body", cache, cacheKey: "k" }),
    );
    await waitFor(() => expect(result.current.status).toBe("done"));

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.status).toBe("unavailable");
    expect(result.current.output).toBeNull();
  });

  it("does not run when enabled=false", async () => {
    const api = installFakeSummarizer();
    const cache = inMemoryCache();
    renderHook(() =>
      useSummarizer({
        language: "en",
        input: "body",
        cache,
        cacheKey: "k",
        enabled: false,
      }),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(api.create).not.toHaveBeenCalled();
  });

  it("falls to 'unavailable' on SummarizerUnavailableError", async () => {
    installFakeSummarizer({ availability: "unavailable" });
    const cache = inMemoryCache();
    const { result } = renderHook(() =>
      useSummarizer({ language: "en", input: "body", cache, cacheKey: "k" }),
    );
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.error).toBeNull();
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
      create: vi.fn(async () => ({ summarize: methodSpy })),
    };
    (globalThis as { Summarizer?: typeof api }).Summarizer = api;

    const { result, rerender } = renderHook(
      ({ input }: { input: string }) =>
        useSummarizer({ language: "en", input }),
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
});
