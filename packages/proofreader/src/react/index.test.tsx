import { renderHook, waitFor } from "@testing-library/react";
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
});
