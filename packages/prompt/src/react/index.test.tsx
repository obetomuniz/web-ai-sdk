import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "../api.js";
import { usePrompt } from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

const installFakeLanguageModel = (
  opts: { chunks?: string[]; response?: string } = {},
): FakeApi => {
  const response = opts.response ?? "answer";
  const chunks = opts.chunks;
  const session = chunks
    ? {
        prompt: vi.fn(async () => response),
        promptStreaming: async function* () {
          for (const c of chunks) yield c;
        },
      }
    : {
        prompt: vi.fn(async () => response),
      };
  const api: FakeApi = {
    availability: vi.fn(async () => "available"),
    create: vi.fn(async () => session),
  };
  (globalThis as { LanguageModel?: FakeApi }).LanguageModel = api;
  return api;
};

const removeFakeLanguageModel = () => {
  (globalThis as { LanguageModel?: unknown }).LanguageModel = undefined;
};

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  removeFakeLanguageModel();
});

describe("usePrompt", () => {
  it("starts in 'unavailable' when the API is missing", () => {
    const { result } = renderHook(() => usePrompt());
    expect(result.current.status).toBe("unavailable");
  });

  it("starts in 'idle' when the API is present", () => {
    installFakeLanguageModel();
    const { result } = renderHook(() => usePrompt());
    expect(result.current.status).toBe("idle");
  });

  it("transitions idle → loading → done on ask()", async () => {
    installFakeLanguageModel({ response: "hello world" });
    const { result } = renderHook(() =>
      usePrompt({
        cache: { get: () => null, set: () => {} },
      }),
    );

    await act(async () => {
      await result.current.ask("hi");
    });

    expect(result.current.status).toBe("done");
    expect(result.current.response).toBe("hello world");
    expect(result.current.error).toBeNull();
  });

  it("flips to 'streaming' as chunks arrive", async () => {
    installFakeLanguageModel({ chunks: ["one ", "two ", "three"] });
    const { result } = renderHook(() =>
      usePrompt({ cache: { get: () => null, set: () => {} } }),
    );

    await act(async () => {
      await result.current.ask("count");
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.response).toBe("one two three");
  });

  it("sets fromCache=true when the result comes from cache", async () => {
    installFakeLanguageModel();
    const memCache = new Map<string, string>();
    memCache.set('["q","",null,null]', "cached!");
    const { result } = renderHook(() =>
      usePrompt({
        cache: {
          get: (k) => memCache.get(k) ?? null,
          set: (k, v) => {
            memCache.set(k, v);
          },
        },
      }),
    );

    await act(async () => {
      await result.current.ask("q");
    });

    expect(result.current.response).toBe("cached!");
    expect(result.current.fromCache).toBe(true);
  });

  it("reset() clears response and returns to 'idle'", async () => {
    installFakeLanguageModel({ response: "x" });
    const { result } = renderHook(() =>
      usePrompt({ cache: { get: () => null, set: () => {} } }),
    );

    await act(async () => {
      await result.current.ask("q");
    });
    expect(result.current.response).toBe("x");

    act(() => result.current.reset());
    expect(result.current.response).toBeNull();
    expect(result.current.status).toBe("idle");
  });
});
