import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "../api.js";
import { useProofreader } from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  proofreadSpy: ReturnType<typeof vi.fn>;
}

const installFakeProofreader = (
  opts: { correctedInput?: string } = {},
): FakeApi => {
  const result = {
    correctedInput: opts.correctedInput ?? "Corrected.",
    corrections: [],
  };
  const proofreadSpy = vi.fn(async () => result);
  const session = { proofread: proofreadSpy };
  const api: FakeApi = {
    availability: vi.fn(async () => "available"),
    create: vi.fn(async () => session),
    proofreadSpy,
  };
  (globalThis as { Proofreader?: unknown }).Proofreader = api;
  return api;
};

const removeFakeProofreader = () => {
  (globalThis as { Proofreader?: unknown }).Proofreader = undefined;
};

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  removeFakeProofreader();
});

describe("useProofreader", () => {
  it("starts in 'unavailable' when the API is missing", () => {
    const { result } = renderHook(() => useProofreader({ input: "hi" }));
    expect(result.current.status).toBe("unavailable");
  });

  it("stays in 'idle' when input is empty", () => {
    installFakeProofreader();
    const { result } = renderHook(() => useProofreader({ input: "  " }));
    expect(result.current.status).toBe("idle");
  });

  it("transitions idle → done and exposes corrected text", async () => {
    installFakeProofreader({ correctedInput: "I have a cat." });
    const { result } = renderHook(() =>
      useProofreader({ input: "I has cat." }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output?.correctedInput).toBe("I have a cat.");
    expect(result.current.error).toBeNull();
  });

  it("re-runs when input changes", async () => {
    const api = installFakeProofreader();
    const { result, rerender } = renderHook(
      ({ input }: { input: string }) => useProofreader({ input }),
      { initialProps: { input: "first" } },
    );
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(api.proofreadSpy).toHaveBeenCalledTimes(1);

    rerender({ input: "second" });
    await waitFor(() => expect(api.proofreadSpy).toHaveBeenCalledTimes(2));
  });

  it("discards a stale request when input changes (cleanup aborts the prior run)", async () => {
    type FakeResult = { correctedInput: string; corrections: [] };
    const resolvers: Array<(out: FakeResult) => void> = [];
    const methodSpy = vi.fn(
      () =>
        new Promise<FakeResult>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const api = {
      availability: vi.fn(async () => "available"),
      create: vi.fn(async () => ({ proofread: methodSpy })),
    };
    (globalThis as { Proofreader?: typeof api }).Proofreader = api;

    const { result, rerender } = renderHook(
      ({ input }: { input: string }) => useProofreader({ input }),
      { initialProps: { input: "A" } },
    );
    await waitFor(() => expect(resolvers).toHaveLength(1));

    rerender({ input: "B" });
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => {
      resolvers[0]?.({ correctedInput: "stale-A", corrections: [] });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.output?.correctedInput).not.toBe("stale-A");

    await act(async () => {
      resolvers[1]?.({ correctedInput: "fresh-B", corrections: [] });
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output?.correctedInput).toBe("fresh-B");
  });
});
