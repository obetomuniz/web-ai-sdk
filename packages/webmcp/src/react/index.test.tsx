import { renderHook } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { Tool } from "../index.js";
import {
  type RegisterToolOptions,
  type UseWebMCPOptions,
  useWebMCP,
} from "./index.js";

interface RegisteredCall {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: Record<string, boolean>;
  execute: (input: unknown) => unknown;
}

type Host = "document" | "navigator";

const setModelContext = (host: Host, value: unknown) => {
  Object.defineProperty(
    host === "document" ? document : navigator,
    "modelContext",
    { value, configurable: true },
  );
};

const installFakeModelContext = (host: Host = "navigator") => {
  const registered = new Map<string, RegisteredCall>();
  const registerTool = vi.fn(
    (
      def: RegisteredCall,
      options?: { signal?: AbortSignal; exposedTo?: readonly string[] },
    ) => {
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

  setModelContext(host, { registerTool });

  return { registered, registerTool };
};

afterEach(() => {
  setModelContext("document", undefined);
  setModelContext("navigator", undefined);
});

describe("useWebMCP", () => {
  it("registers a single tool", () => {
    const { registered } = installFakeModelContext();
    const tool: Tool = {
      name: "single",
      description: "One tool",
      execute: async () => ({}),
    };

    const { unmount } = renderHook(() => useWebMCP(tool));
    expect(registered.has("single")).toBe(true);
    unmount();
    expect(registered.has("single")).toBe(false);
  });

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

  it("re-registers when discoverable tool metadata changes", () => {
    const { registered, registerTool } = installFakeModelContext();
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
    expect(registerTool).toHaveBeenCalledTimes(2);
  });

  it("skips registration while disabled and follows enabled transitions", () => {
    const { registered } = installFakeModelContext();
    const tool: Tool = {
      name: "conditional",
      description: "Only available while signed in",
      execute: async () => ({}),
    };

    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => useWebMCP(tool, { enabled }),
      { initialProps: { enabled: false } },
    );
    expect(registered.has("conditional")).toBe(false);

    rerender({ enabled: true });
    expect(registered.has("conditional")).toBe(true);

    rerender({ enabled: false });
    expect(registered.has("conditional")).toBe(false);
    unmount();
  });

  it("forwards exposedTo and re-registers when it changes", () => {
    const { registered, registerTool } = installFakeModelContext();
    const tool: Tool = {
      name: "shared",
      description: "Shared with embedded agents",
      execute: async () => ({}),
    };
    const first = ["https://one.example"] as const;
    const second = ["https://two.example"] as const;

    const { rerender, unmount } = renderHook(
      ({ exposedTo }: { exposedTo: readonly string[] }) =>
        useWebMCP(tool, { exposedTo }),
      { initialProps: { exposedTo: first as readonly string[] } },
    );
    expect(registerTool.mock.calls[0]?.[1]?.exposedTo).toBe(first);

    rerender({ exposedTo: second });
    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(registerTool.mock.calls[1]?.[1]?.exposedTo).toBe(second);
    expect(registered.has("shared")).toBe(true);
    unmount();
    expect(registered.has("shared")).toBe(false);
  });

  it("does not re-register when stable inputs are rerendered", () => {
    const { registerTool } = installFakeModelContext();
    const tool: Tool = {
      name: "stable",
      description: "Stable tool",
      execute: async () => ({}),
    };
    const options: UseWebMCPOptions = {
      exposedTo: ["https://agent.example"],
    };

    const { rerender, unmount } = renderHook(
      ({ value }: { value: number }) => {
        void value;
        useWebMCP(tool, options);
      },
      { initialProps: { value: 1 } },
    );
    rerender({ value: 2 });

    expect(registerTool).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("uses the latest execute callback without re-registering", () => {
    const { registered, registerTool } = installFakeModelContext();

    const { rerender, unmount } = renderHook(
      ({ value }: { value: number }) =>
        useWebMCP(
          {
            name: "live-state",
            description: "Read the latest state",
            annotations: { readOnlyHint: true },
            execute: () => value,
          },
          { exposedTo: ["https://agent.example"] },
        ),
      { initialProps: { value: 1 } },
    );
    const registeredTool = registered.get("live-state");
    expect(registeredTool?.execute(undefined)).toBe(1);

    rerender({ value: 2 });

    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registeredTool?.execute(undefined)).toBe(2);
    unmount();
  });

  it("keeps fresh callbacks matched to tools in recreated arrays", () => {
    const { registered, registerTool } = installFakeModelContext();

    const { rerender, unmount } = renderHook(
      ({ first, second }: { first: string; second: string }) =>
        useWebMCP([
          {
            name: "first",
            description: "Read the first value",
            execute: () => first,
          },
          {
            name: "second",
            description: "Read the second value",
            execute: () => second,
          },
        ]),
      { initialProps: { first: "a", second: "b" } },
    );
    const firstTool = registered.get("first");
    const secondTool = registered.get("second");

    rerender({ first: "c", second: "d" });

    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(firstTool?.execute(undefined)).toBe("c");
    expect(secondTool?.execute(undefined)).toBe("d");
    unmount();
  });

  it("keeps one live registration in Strict Mode and cleans it up", () => {
    const { registered } = installFakeModelContext();
    const tool: Tool = {
      name: "strict",
      description: "Strict Mode tool",
      execute: async () => ({}),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );

    const { unmount } = renderHook(() => useWebMCP(tool), { wrapper });
    expect(registered.has("strict")).toBe(true);
    unmount();
    expect(registered.has("strict")).toBe(false);
  });

  it("re-exports the vanilla options and accepts both input shapes", () => {
    const tool: Tool = {
      name: "typed",
      description: "Typed tool",
      execute: () => ({}),
    };
    const registrationOptions: RegisterToolOptions = {
      exposedTo: ["https://agent.example"],
    };
    const hookOptions: UseWebMCPOptions = {
      ...registrationOptions,
      enabled: true,
    };

    expectTypeOf(useWebMCP).toBeCallableWith(tool, hookOptions);
    expectTypeOf(useWebMCP).toBeCallableWith([tool] as const, hookOptions);
  });

  it("works when modelContext is exposed on document instead of navigator", () => {
    const { registered } = installFakeModelContext("document");
    const tools: Tool[] = [
      { name: "a", description: "A", execute: async () => ({}) },
    ];

    const { unmount } = renderHook(() => useWebMCP(tools));
    expect(registered.has("a")).toBe(true);
    unmount();
    expect(registered.has("a")).toBe(false);
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
