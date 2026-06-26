import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "../api.js";
import { useRewriter } from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  rewriteSpy: ReturnType<typeof vi.fn>;
}

const installFakeRewriter = (opts: { output?: string } = {}): FakeApi => {
  const output = opts.output ?? "Rewritten.";
  const rewriteSpy = vi.fn(async () => output);
  const rewriter = { rewrite: rewriteSpy };
  const api = {
    availability: vi.fn(async () => "available"),
    create: vi.fn(async () => rewriter),
    rewriteSpy,
  };
  (globalThis as { Rewriter?: unknown }).Rewriter = api;
  return api as FakeApi;
};

const removeFakeRewriter = () => {
  (globalThis as { Rewriter?: unknown }).Rewriter = undefined;
};

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  removeFakeRewriter();
});

describe("useRewriter", () => {
  it("starts in 'unavailable' when the API is missing", () => {
    const { result } = renderHook(() => useRewriter({ input: "text" }));
    expect(result.current.status).toBe("unavailable");
  });

  it("stays in 'idle' when input is empty", () => {
    installFakeRewriter();
    const { result } = renderHook(() => useRewriter({ input: "  " }));
    expect(result.current.status).toBe("idle");
  });

  it("transitions idle → done and exposes the output", async () => {
    installFakeRewriter({ output: "Tighter copy." });
    const { result } = renderHook(() =>
      useRewriter({ input: "A long sentence.", length: "shorter" }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBe("Tighter copy.");
    expect(result.current.error).toBeNull();
  });

  it("sets status to done, not unavailable, when the result is empty", async () => {
    installFakeRewriter({ output: "" });
    const { result } = renderHook(() =>
      useRewriter({ input: "A long sentence.", length: "shorter" }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("re-runs when input changes", async () => {
    const api = installFakeRewriter({ output: "ok" });
    const { result, rerender } = renderHook(
      ({ input }: { input: string }) => useRewriter({ input }),
      { initialProps: { input: "first" } },
    );
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(api.rewriteSpy).toHaveBeenCalledTimes(1);

    rerender({ input: "second" });
    await waitFor(() => expect(api.rewriteSpy).toHaveBeenCalledTimes(2));
  });
});
