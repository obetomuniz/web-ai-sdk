import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, StrictMode, useLayoutEffect } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { StandardSchemaV1, Tool, ToolDefinition } from "../index.js";
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

const stringSchema = (label: string): StandardSchemaV1<string, string> => ({
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value: unknown) =>
      typeof value === "string"
        ? { value }
        : { issues: [{ message: `${label} must be a string` }] },
    types: { input: "" as string, output: "" as string },
  },
});

const numericStringSchema: StandardSchemaV1<string, number> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value: unknown) =>
      typeof value === "string" && /^\d+$/.test(value)
        ? { value: Number(value) }
        : { issues: [{ message: "value must be a numeric string" }] },
    types: { input: "" as string, output: 0 as number },
  },
};

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

  it("registers and validates a direct schema-aware definition", async () => {
    const { registered, registerTool } = installFakeModelContext();

    const { unmount } = renderHook(() =>
      useWebMCP({
        name: "increment",
        description: "Increment a numeric string",
        input: numericStringSchema,
        inputSchema: { type: "string", pattern: "^\\d+$" },
        execute: (count) => {
          expectTypeOf(count).toEqualTypeOf<number>();
          return count + 1;
        },
      }),
    );

    const definition = registerTool.mock.calls[0]?.[0];
    expect(definition).not.toHaveProperty("input");
    await expect(registered.get("increment")?.execute("41")).resolves.toBe(42);
    await expect(
      registered.get("increment")?.execute("nope"),
    ).rejects.toMatchObject({
      name: "ToolValidationError",
      toolName: "increment",
    });
    unmount();
  });

  it("accepts heterogeneous direct definitions with per-tool inference", async () => {
    const { registered } = installFakeModelContext();
    const textTool = {
      name: "text",
      description: "Echo text",
      input: stringSchema("text"),
      execute: (text) => {
        expectTypeOf(text).toEqualTypeOf<string>();
        return text.toUpperCase();
      },
    } satisfies ToolDefinition<StandardSchemaV1<string, string>, string>;
    const numberTool = {
      name: "number",
      description: "Parse a number",
      input: numericStringSchema,
      execute: (count) => {
        expectTypeOf(count).toEqualTypeOf<number>();
        return count + 1;
      },
    } satisfies ToolDefinition<StandardSchemaV1<string, number>, number>;

    const { unmount } = renderHook(() =>
      useWebMCP([textTool, numberTool] as const),
    );

    await expect(registered.get("text")?.execute("hello")).resolves.toBe(
      "HELLO",
    );
    await expect(registered.get("number")?.execute("41")).resolves.toBe(42);
    unmount();
  });

  it("uses the latest schema and callback without re-registering", async () => {
    const { registered, registerTool } = installFakeModelContext();

    const { rerender, unmount } = renderHook(
      ({ label, suffix }: { label: string; suffix: string }) =>
        useWebMCP({
          name: "fresh-schema",
          description: "Use current validation and state",
          input: stringSchema(label),
          execute: (text) => `${text}:${suffix}`,
        }),
      { initialProps: { label: "first", suffix: "a" } },
    );
    const registeredTool = registered.get("fresh-schema");

    rerender({ label: "second", suffix: "b" });

    expect(registerTool).toHaveBeenCalledTimes(1);
    await expect(registeredTool?.execute("value")).resolves.toBe("value:b");
    await expect(registeredTool?.execute(123)).rejects.toThrow(
      "second must be a string",
    );
    unmount();
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

  it("does not inspect registration metadata while disabled", () => {
    const { registerTool } = installFakeModelContext();
    const toJSON = vi.fn(() => ({ type: "object" }));

    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useWebMCP(
          {
            name: "disabled-metadata",
            description: "Stay inert while disabled",
            inputSchema: { toJSON },
            execute: async () => ({}),
          },
          { enabled },
        ),
      { initialProps: { enabled: false } },
    );

    expect(toJSON).not.toHaveBeenCalled();
    expect(registerTool).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(toJSON).toHaveBeenCalled();
    expect(registerTool).toHaveBeenCalledOnce();
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

  it("compares the effective annotations sent to the host", () => {
    const { registerTool } = installFakeModelContext();

    const { rerender, unmount } = renderHook(
      ({ readOnly }: { readOnly: boolean }) =>
        useWebMCP({
          name: "annotation-override",
          description: "Respect raw annotation overrides",
          readOnly,
          annotations: { readOnlyHint: false },
          execute: async () => ({}),
        }),
      { initialProps: { readOnly: true } },
    );

    rerender({ readOnly: false });

    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool.mock.calls[0]?.[0].annotations).toEqual({
      readOnlyHint: false,
    });
    unmount();
  });

  it("re-registers when an effective shorthand annotation changes", () => {
    const { registerTool } = installFakeModelContext();

    const { rerender, unmount } = renderHook(
      ({ readOnly }: { readOnly: boolean }) =>
        useWebMCP({
          name: "annotation-change",
          description: "Track effective annotations",
          readOnly,
          execute: async () => ({}),
        }),
      { initialProps: { readOnly: true } },
    );

    rerender({ readOnly: false });

    expect(registerTool).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("does not re-register equivalent metadata with reordered object keys", () => {
    const { registerTool } = installFakeModelContext();
    const firstSchema = {
      type: "object",
      properties: { query: { type: "string", minLength: 1 } },
    };
    const reorderedSchema = {
      properties: { query: { minLength: 1, type: "string" } },
      type: "object",
    };

    const { rerender, unmount } = renderHook(
      ({ inputSchema }: { inputSchema: object }) =>
        useWebMCP({
          name: "equivalent-schema",
          description: "Compare metadata by value",
          inputSchema,
          execute: async () => ({}),
        }),
      { initialProps: { inputSchema: firstSchema } },
    );

    rerender({ inputSchema: reorderedSchema });

    expect(registerTool).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("compares circular metadata without crashing during render", () => {
    const { registerTool } = installFakeModelContext();
    const createCircularSchema = (type: string) => {
      const schema: { self?: object; type: string } = { type };
      schema.self = schema;
      return schema;
    };

    const { rerender, unmount } = renderHook(
      ({ inputSchema }: { inputSchema: object }) =>
        useWebMCP({
          name: "circular-schema",
          description: "Handle non-serializable metadata",
          inputSchema,
          execute: async () => ({}),
        }),
      { initialProps: { inputSchema: createCircularSchema("object") } },
    );

    rerender({ inputSchema: createCircularSchema("object") });
    expect(registerTool).toHaveBeenCalledTimes(1);

    rerender({ inputSchema: createCircularSchema("array") });
    expect(registerTool).toHaveBeenCalledTimes(2);
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

  it("updates execute callbacks before consumer layout effects run", () => {
    const { registered, registerTool } = installFakeModelContext();
    const observed: number[] = [];

    const { rerender, unmount } = renderHook(
      ({ value }: { value: number }) => {
        useWebMCP({
          name: "commit-state",
          description: "Read state from the latest commit",
          execute: () => value,
        });
        useLayoutEffect(() => {
          const result = registered.get("commit-state")?.execute(undefined);
          if (typeof result === "number") observed.push(result);
        });
      },
      { initialProps: { value: 1 } },
    );

    rerender({ value: 2 });

    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(observed.at(-1)).toBe(2);
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

  it("keeps callbacks paired with duplicate-name tool definitions", () => {
    const { registerTool } = installFakeModelContext();

    const { unmount } = renderHook(() =>
      useWebMCP([
        {
          name: "duplicate",
          description: "First definition",
          execute: () => "first",
        },
        {
          name: "duplicate",
          description: "Second definition",
          execute: () => "second",
        },
      ]),
    );

    const firstDefinition = registerTool.mock.calls[0]?.[0];
    const secondDefinition = registerTool.mock.calls[1]?.[0];
    expect(firstDefinition?.description).toBe("First definition");
    expect(firstDefinition?.execute(undefined)).toBe("first");
    expect(secondDefinition?.description).toBe("Second definition");
    expect(secondDefinition?.execute(undefined)).toBe("second");
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

describe("useWebMCP discovery", () => {
  const discoveredTool = () => ({
    name: "echo",
    title: "Echo",
    description: "Echo a value.",
    inputSchema: '{"type":"object"}',
    window,
    origin: window.location.origin,
    annotations: { readOnlyHint: true },
  });

  const installDiscoverySurface = () => {
    const events = new EventTarget();
    const tools = [discoveredTool()];
    const getTools = vi.fn(async () => tools);
    setModelContext("document", {
      registerTool: vi.fn(),
      getTools,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    });
    return { events, getTools, tools };
  };

  it("reports unavailable with an empty list when WebMCP is missing", async () => {
    const { result } = renderHook(() => useWebMCP());

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.tools).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("retrieves tools and forwards origin filters", async () => {
    const { getTools, tools } = installDiscoverySurface();
    const fromOrigins = ["https://agent.example"] as const;
    const { result } = renderHook(() => useWebMCP({ fromOrigins }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.tools).toEqual(tools);
    expect(getTools).toHaveBeenCalledWith({ fromOrigins });
  });

  it("keeps discovery idle while disabled and starts after enabling", async () => {
    const { getTools } = installDiscoverySurface();
    const { result, rerender } = renderHook(
      ({ enabled }) => useWebMCP({ enabled }),
      { initialProps: { enabled: false } },
    );

    expect(result.current.status).toBe("idle");
    expect(result.current.tools).toEqual([]);
    expect(getTools).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getTools).toHaveBeenCalledOnce();
  });

  it("refreshes after tool changes and exposes manual refresh", async () => {
    const { events, getTools, tools } = installDiscoverySurface();
    const { result, unmount } = renderHook(() => useWebMCP());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => events.dispatchEvent(new Event("toolchange")));
    await waitFor(() => expect(getTools).toHaveBeenCalledTimes(2));

    await expect(result.current.refresh()).resolves.toEqual(tools);
    expect(getTools).toHaveBeenCalledTimes(3);

    unmount();
    events.dispatchEvent(new Event("toolchange"));
    expect(getTools).toHaveBeenCalledTimes(3);
  });

  it("reports discovery failures without rejecting the component", async () => {
    const failure = new DOMException("Denied", "NotAllowedError");
    setModelContext("document", {
      registerTool: vi.fn(),
      getTools: vi.fn(async () => Promise.reject(failure)),
    });
    const { result } = renderHook(() => useWebMCP());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
    expect(result.current.tools).toEqual([]);
  });
});
