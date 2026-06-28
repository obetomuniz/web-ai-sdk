import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "../api.js";
import { usePrompt, useSession } from "./index.js";

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
    expect(result.current.output).toBe("hello world");
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
    expect(result.current.output).toBe("one two three");
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

    expect(result.current.output).toBe("cached!");
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
    expect(result.current.output).toBe("x");

    act(() => result.current.reset());
    expect(result.current.output).toBeNull();
    expect(result.current.status).toBe("idle");
  });
});

describe("useSession", () => {
  it("starts 'unavailable' when the API is missing", () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.status).toBe("unavailable");
    expect(result.current.session).toBeNull();
  });

  it("starts 'loading' while native create is pending", async () => {
    let resolveCreate:
      | ((session: { prompt: ReturnType<typeof vi.fn> }) => void)
      | undefined;
    const api = {
      availability: vi.fn(async () => "available"),
      create: vi.fn(
        () =>
          new Promise<{ prompt: ReturnType<typeof vi.fn> }>((resolve) => {
            resolveCreate = resolve;
          }),
      ),
    };
    (globalThis as { LanguageModel?: typeof api }).LanguageModel = api;

    const { result } = renderHook(() => useSession());
    expect(result.current.status).toBe("loading");
    expect(result.current.session).toBeNull();

    await act(async () => {
      if (!resolveCreate) throw new Error("create was not called");
      resolveCreate({ prompt: vi.fn(async () => "ok") });
    });
  });

  it("transitions to 'ready' when native create resolves", async () => {
    installFakeLanguageModel();
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.session).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("transitions to 'unavailable' with an error when native create rejects", async () => {
    const api = {
      availability: vi.fn(async () => "available"),
      create: vi.fn(async () => {
        throw new Error("native create failed");
      }),
    };
    (globalThis as { LanguageModel?: typeof api }).LanguageModel = api;

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.session).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("native create failed");
  });

  it("two hook calls create two independent underlying sessions", () => {
    const api = installFakeLanguageModel();
    renderHook(() => useSession({ systemPrompt: "S" }));
    renderHook(() => useSession({ systemPrompt: "S" }));
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("consumers iterate session.sendStreaming() themselves", async () => {
    installFakeLanguageModel({ chunks: ["He", "llo"] });
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const session = result.current.session;
    expect(session).not.toBeNull();

    const collected: string[] = [];
    if (session) {
      for await (const delta of session.sendStreaming("hi")) {
        collected.push(delta);
      }
    }
    expect(collected.join("")).toBe("Hello");
  });

  it("destroys the session on unmount", async () => {
    let destroyed = false;
    const api = {
      availability: vi.fn(async () => "available"),
      create: vi.fn(async () => ({
        prompt: vi.fn(async () => "ok"),
        destroy: () => {
          destroyed = true;
        },
      })),
    };
    (globalThis as { LanguageModel?: typeof api }).LanguageModel = api;
    const { result, unmount } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.session).not.toBeNull();
    unmount();
    await Promise.resolve();
    expect(destroyed).toBe(true);
  });

  it("recreates the session when a primitive option changes", () => {
    const api = installFakeLanguageModel();
    const { rerender } = renderHook(
      ({ p }: { p: string }) => useSession({ systemPrompt: p }),
      { initialProps: { p: "A" } },
    );
    expect(api.create).toHaveBeenCalledTimes(1);
    rerender({ p: "B" });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("recreates the session when samplingMode changes", () => {
    const api = installFakeLanguageModel();
    type SamplingModeProps = { samplingMode: "predictable" | "creative" };
    const initialProps: SamplingModeProps = { samplingMode: "predictable" };
    const { rerender } = renderHook(
      ({ samplingMode }: SamplingModeProps) => useSession({ samplingMode }),
      { initialProps },
    );
    expect(api.create).toHaveBeenCalledTimes(1);
    rerender({ samplingMode: "creative" });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("forwards monitor onto the LanguageModel.create() call", async () => {
    const api = installFakeLanguageModel();
    const monitor = vi.fn();
    const { result } = renderHook(() =>
      useSession({ systemPrompt: "S", monitor }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const createOpts = api.create.mock.calls[0]?.[0];
    expect(createOpts).toMatchObject({ monitor });
  });
});
