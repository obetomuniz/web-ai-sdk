import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "../api.js";
import { useWriter } from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  writeSpy: ReturnType<typeof vi.fn>;
}

const installFakeWriter = (opts: { output?: string } = {}): FakeApi => {
  const output = opts.output ?? "Generated.";
  const writeSpy = vi.fn(async () => output);
  const writer = { write: writeSpy };
  const api = {
    availability: vi.fn(async () => "available"),
    create: vi.fn(async () => writer),
    writeSpy,
  };
  (globalThis as { Writer?: unknown }).Writer = api;
  return api as FakeApi;
};

const removeFakeWriter = () => {
  (globalThis as { Writer?: unknown }).Writer = undefined;
};

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  removeFakeWriter();
});

describe("useWriter", () => {
  it("starts in 'unavailable' when the API is missing", () => {
    const { result } = renderHook(() => useWriter({ input: "Draft." }));
    expect(result.current.status).toBe("unavailable");
  });

  it("stays in 'idle' when input is empty", () => {
    installFakeWriter();
    const { result } = renderHook(() => useWriter({ input: "  " }));
    expect(result.current.status).toBe("idle");
  });

  it("transitions idle → done and exposes the output", async () => {
    installFakeWriter({ output: "Dear team," });
    const { result } = renderHook(() =>
      useWriter({ input: "Draft an email." }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBe("Dear team,");
    expect(result.current.error).toBeNull();
  });

  it("sets status to done, not unavailable, when the result is empty", async () => {
    installFakeWriter({ output: "" });
    const { result } = renderHook(() =>
      useWriter({ input: "Draft an email." }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.output).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("re-runs when input changes", async () => {
    const api = installFakeWriter({ output: "ok" });
    const { result, rerender } = renderHook(
      ({ input }: { input: string }) => useWriter({ input }),
      { initialProps: { input: "first" } },
    );
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(api.writeSpy).toHaveBeenCalledTimes(1);

    rerender({ input: "second" });
    await waitFor(() => expect(api.writeSpy).toHaveBeenCalledTimes(2));
  });

  it("dismiss() clears output and marks unavailable", async () => {
    installFakeWriter({ output: "Body." });
    const { result } = renderHook(() => useWriter({ input: "Write." }));
    await waitFor(() => expect(result.current.status).toBe("done"));
    result.current.dismiss();
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
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
      availability: vi.fn(async () => "available"),
      create: vi.fn(async () => ({ write: methodSpy })),
    };
    (globalThis as { Writer?: typeof api }).Writer = api;

    const { result, rerender } = renderHook(
      ({ input }: { input: string }) => useWriter({ input }),
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
