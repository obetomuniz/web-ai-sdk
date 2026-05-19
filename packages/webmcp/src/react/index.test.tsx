import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Tool } from "../index.js";
import { useWebMCP } from "./index.js";

interface RegisteredCall {
  name: string;
  description: string;
  inputSchema?: object;
  annotations?: Record<string, boolean>;
  execute: (input: unknown) => unknown;
}

const installFakeModelContext = () => {
  const registered = new Map<string, RegisteredCall>();
  const registerTool = vi.fn(
    (def: RegisteredCall, options?: { signal?: AbortSignal }) => {
      if (registered.has(def.name)) {
        throw new Error(
          "Failed to execute 'registerTool' on 'ModelContext': Duplicate tool name",
        );
      }
      registered.set(def.name, def);
      options?.signal?.addEventListener("abort", () => {
        registered.delete(def.name);
      });
    },
  );

  Object.defineProperty(navigator, "modelContext", {
    value: { registerTool },
    configurable: true,
  });

  return { registered };
};

afterEach(() => {
  Object.defineProperty(navigator, "modelContext", {
    value: undefined,
    configurable: true,
  });
});

describe("useWebMCP", () => {
  it("registers tools on mount and unregisters them on unmount", () => {
    const { registered } = installFakeModelContext();
    const tools: Tool[] = [
      { name: "a", description: "A", execute: async () => ({}) },
      { name: "b", description: "B", execute: async () => ({}) },
    ];

    const { unmount } = renderHook(() => useWebMCP(tools));
    expect(registered.size).toBe(2);
    expect(registered.has("a")).toBe(true);
    expect(registered.has("b")).toBe(true);

    unmount();
    expect(registered.size).toBe(0);
  });

  it("re-registers when the tools array reference changes", () => {
    const { registered } = installFakeModelContext();
    const v1: Tool[] = [
      { name: "a", description: "v1", execute: async () => ({}) },
    ];
    const v2: Tool[] = [
      { name: "b", description: "v2", execute: async () => ({}) },
    ];

    const { rerender } = renderHook(
      ({ tools }: { tools: Tool[] }) => useWebMCP(tools),
      { initialProps: { tools: v1 } },
    );
    expect(registered.has("a")).toBe(true);

    rerender({ tools: v2 });
    expect(registered.has("a")).toBe(false);
    expect(registered.has("b")).toBe(true);
  });

  it("is a no-op when WebMCP is unavailable", () => {
    const tools: Tool[] = [
      { name: "a", description: "A", execute: async () => ({}) },
    ];
    expect(() => {
      const { unmount } = renderHook(() => useWebMCP(tools));
      unmount();
    }).not.toThrow();
  });
});
