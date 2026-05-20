import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type StandardSchemaV1,
  ToolValidationError,
  defineTool,
  getModelContext,
  isWebMCPAvailable,
  registerTool,
  registerTools,
} from "./index.js";

interface RegisteredCall {
  name: string;
  description: string;
  inputSchema?: object;
  annotations?: Record<string, boolean>;
  execute: (input: unknown) => unknown;
}

interface RegisterOptions {
  signal?: AbortSignal;
}

/**
 * Mirror Chrome's native `navigator.modelContext` shape: a single
 * `registerTool(def, { signal? })` method. There is no `unregisterTool`;
 * cleanup happens by aborting the signal that was passed at registration.
 */
const installFakeModelContext = () => {
  const registered = new Map<string, RegisteredCall>();
  const registerTool = vi.fn(
    (def: RegisteredCall, options?: RegisterOptions) => {
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

  const mc = { registerTool };
  Object.defineProperty(navigator, "modelContext", {
    value: mc,
    configurable: true,
  });

  return { mc, registered, registerTool };
};

const removeModelContext = () => {
  Object.defineProperty(navigator, "modelContext", {
    value: undefined,
    configurable: true,
  });
};

afterEach(() => {
  removeModelContext();
});

describe("feature detection", () => {
  it("isWebMCPAvailable() is false when navigator.modelContext is missing", () => {
    expect(isWebMCPAvailable()).toBe(false);
    expect(getModelContext()).toBeUndefined();
  });

  it("isWebMCPAvailable() is true when navigator.modelContext is present", () => {
    installFakeModelContext();
    expect(isWebMCPAvailable()).toBe(true);
    expect(getModelContext()).toBeDefined();
  });
});

describe("registerTool", () => {
  it("returns a no-op cleanup when WebMCP is unavailable", () => {
    const cleanup = registerTool({
      name: "noop",
      description: "no-op",
      execute: async () => ({}),
    });
    expect(() => cleanup()).not.toThrow();
  });

  it("forwards name/description/execute to navigator.modelContext", async () => {
    const { registered, registerTool: spy } = installFakeModelContext();

    registerTool({
      name: "ping",
      description: "Returns pong.",
      execute: async () => ({ result: "pong" }),
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const def = registered.get("ping");
    expect(def?.name).toBe("ping");
    expect(def?.description).toBe("Returns pong.");
    await expect(def?.execute(undefined)).resolves.toEqual({ result: "pong" });
  });

  it("passes an AbortSignal through to registerTool", () => {
    const { registerTool: spy } = installFakeModelContext();
    registerTool({
      name: "with-signal",
      description: "x",
      execute: async () => ({}),
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const options = spy.mock.calls[0]?.[1] as RegisterOptions | undefined;
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.signal?.aborted).toBe(false);
  });

  it("translates the readOnly shorthand to annotations.readOnlyHint", () => {
    const { registered } = installFakeModelContext();
    registerTool({
      name: "list",
      description: "lists",
      readOnly: true,
      execute: async () => ({}),
    });
    expect(registered.get("list")?.annotations).toEqual({ readOnlyHint: true });
  });

  it("translates the destructive shorthand to annotations.destructiveHint", () => {
    const { registered } = installFakeModelContext();
    registerTool({
      name: "send",
      description: "sends",
      destructive: true,
      execute: async () => ({}),
    });
    expect(registered.get("send")?.annotations).toEqual({
      destructiveHint: true,
    });
  });

  it("merges raw annotations on top of shorthand flags", () => {
    const { registered } = installFakeModelContext();
    registerTool({
      name: "merge",
      description: "merges",
      readOnly: true,
      annotations: { idempotentHint: true, openWorldHint: false },
      execute: async () => ({}),
    });
    expect(registered.get("merge")?.annotations).toEqual({
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it("omits annotations entirely when no flags are set", () => {
    const { registered } = installFakeModelContext();
    registerTool({
      name: "plain",
      description: "plain",
      execute: async () => ({}),
    });
    expect(registered.get("plain")?.annotations).toBeUndefined();
  });

  it("preserves inputSchema verbatim", () => {
    const { registered } = installFakeModelContext();
    const schema = { type: "object", properties: { q: { type: "string" } } };
    registerTool({
      name: "search",
      description: "searches",
      inputSchema: schema,
      execute: async () => ({}),
    });
    expect(registered.get("search")?.inputSchema).toBe(schema);
  });

  it("cleanup unregisters the tool by aborting the registration signal", () => {
    const { registered } = installFakeModelContext();
    const cleanup = registerTool({
      name: "temp",
      description: "tmp",
      execute: async () => ({}),
    });
    expect(registered.has("temp")).toBe(true);
    cleanup();
    expect(registered.has("temp")).toBe(false);
  });

  it("cleanup is idempotent. Calling twice does not throw.", () => {
    installFakeModelContext();
    const cleanup = registerTool({
      name: "temp",
      description: "tmp",
      execute: async () => ({}),
    });
    cleanup();
    expect(() => cleanup()).not.toThrow();
  });

  it("evicts a prior live registration for the same name (last writer wins)", () => {
    const { registered } = installFakeModelContext();
    const cleanupA = registerTool({
      name: "shared",
      description: "first",
      execute: () => ({ which: "A" }),
    });
    expect(registered.get("shared")?.description).toBe("first");

    // Fresh call for the same name. The prior controller should be aborted
    // (which removes the first registration) so this one can take the slot.
    const cleanupB = registerTool({
      name: "shared",
      description: "second",
      execute: () => ({ which: "B" }),
    });
    expect(registered.get("shared")?.description).toBe("second");

    // The first caller's cleanup is a no-op now (its controller was already
    // aborted by the second call).
    cleanupA();
    expect(registered.get("shared")?.description).toBe("second");

    // The second caller's cleanup removes the tool.
    cleanupB();
    expect(registered.has("shared")).toBe(false);
  });

  it("warns and skips when the name is owned outside the wrapper (no throw)", async () => {
    const { registered } = installFakeModelContext();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Pre-occupy "a" directly. The wrapper has no controller for this and
    // can't evict it; we don't want to crash the consumer.
    registered.set("a", {
      name: "a",
      description: "owned by someone else",
      execute: () => ({}),
    });
    const cleanup = registerTool({
      name: "a",
      description: "ours",
      execute: async () => ({}),
    });
    // The wrapper retries on a microtask before giving up; flush it.
    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/already registered/i),
    );
    // Pre-existing registration is left in place.
    expect(registered.get("a")?.description).toBe("owned by someone else");
    // Cleanup is a no-op (doesn't tear down the other caller's tool).
    expect(() => cleanup()).not.toThrow();
    expect(registered.has("a")).toBe(true);
    warnSpy.mockRestore();
  });

  it("retries on a microtask after a transient duplicate and lands the registration", async () => {
    const map = new Map<
      string,
      { name: string; description: string; execute: (i: unknown) => unknown }
    >();
    let calls = 0;
    const registerTool_ = vi.fn(
      (
        def: {
          name: string;
          description: string;
          execute: (i: unknown) => unknown;
        },
        options?: { signal?: AbortSignal },
      ) => {
        calls += 1;
        // First call: synthesize a duplicate (Chrome hasn't drained its
        // pending abort yet). Second call (the microtask retry): land it.
        if (calls === 1) {
          throw new Error(
            "Failed to execute 'registerTool' on 'ModelContext': Duplicate tool name",
          );
        }
        map.set(def.name, def);
        options?.signal?.addEventListener("abort", () => {
          map.delete(def.name);
        });
      },
    );
    Object.defineProperty(navigator, "modelContext", {
      value: { registerTool: registerTool_ },
      configurable: true,
    });

    registerTool({ name: "t", description: "d", execute: async () => ({}) });
    expect(map.has("t")).toBe(false); // not yet; retry is queued
    await Promise.resolve(); // flush microtask
    expect(map.has("t")).toBe(true); // retry landed it
    expect(registerTool_).toHaveBeenCalledTimes(2);
  });
});

describe("defineTool", () => {
  // Tiny Standard-Schema-shaped validator for tests; mirrors what a real
  // Zod/Valibot schema would expose via the `~standard` property. Kept inline
  // so the webmcp package stays dependency-free.
  const stringSchema = (label: string): StandardSchemaV1<string, string> => ({
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value: unknown) => {
        if (typeof value === "string") {
          return { value };
        }
        return {
          issues: [{ message: `${label} must be a string`, path: [] }],
        };
      },
      types: { input: "" as string, output: "" as string },
    },
  });

  it("returns a Tool that registers via the existing surface", () => {
    const { registered } = installFakeModelContext();
    const tool = defineTool({
      name: "echo",
      description: "echoes",
      input: stringSchema("input"),
      inputSchema: { type: "string" },
      execute: (text) => ({ text }),
    });
    registerTool(tool);
    expect(registered.get("echo")?.inputSchema).toEqual({ type: "string" });
  });

  it("does NOT validate by default (purely additive type narrowing)", async () => {
    const tool = defineTool({
      name: "echo",
      description: "echoes",
      input: stringSchema("input"),
      execute: (text) => ({ text }),
    });
    // Pass a non-string at runtime; with validate=false the execute runs
    // verbatim (here sync, since the user's execute is sync).
    const out = await (tool.execute as (i: unknown) => unknown)(123);
    expect(out).toEqual({ text: 123 });
  });

  it("validates and throws ToolValidationError when validate:true and input fails", async () => {
    const tool = defineTool({
      name: "echo",
      description: "echoes",
      input: stringSchema("input"),
      validate: true,
      execute: (text) => ({ text }),
    });
    await expect(
      (tool.execute as (i: unknown) => unknown)(123),
    ).rejects.toBeInstanceOf(ToolValidationError);
  });

  it("validates and passes the parsed value through when validate:true and input is valid", async () => {
    const tool = defineTool({
      name: "echo",
      description: "echoes",
      input: stringSchema("input"),
      validate: true,
      execute: (text) => ({ text }),
    });
    await expect(
      (tool.execute as (i: unknown) => Promise<unknown>)("hi"),
    ).resolves.toEqual({ text: "hi" });
  });

  it("forwards readOnly / destructive shorthands to the resulting Tool", () => {
    const tool = defineTool({
      name: "list",
      description: "lists",
      readOnly: true,
      execute: () => [],
    });
    expect(tool.readOnly).toBe(true);
    expect(tool.destructive).toBeUndefined();
  });

  it("works without a Standard Schema (input is unknown)", () => {
    const { registered } = installFakeModelContext();
    const tool = defineTool({
      name: "plain",
      description: "plain",
      inputSchema: { type: "object" },
      execute: () => ({ ok: true }),
    });
    registerTool(tool);
    expect(registered.get("plain")?.inputSchema).toEqual({ type: "object" });
  });
});

describe("registerTools", () => {
  it("registers every tool and the cleanup unregisters all of them", () => {
    const { registered } = installFakeModelContext();
    const cleanup = registerTools([
      { name: "a", description: "A", execute: async () => ({}) },
      { name: "b", description: "B", execute: async () => ({}) },
      { name: "c", description: "C", execute: async () => ({}) },
    ]);
    expect(registered.size).toBe(3);
    cleanup();
    expect(registered.size).toBe(0);
  });

  it("shares one AbortController across all tools (cleanup is atomic)", () => {
    const { registered, registerTool: spy } = installFakeModelContext();
    registerTools([
      { name: "x", description: "X", execute: () => ({}) },
      { name: "y", description: "Y", execute: () => ({}) },
    ]);
    const signalX = (spy.mock.calls[0]?.[1] as RegisterOptions | undefined)
      ?.signal;
    const signalY = (spy.mock.calls[1]?.[1] as RegisterOptions | undefined)
      ?.signal;
    expect(signalX).toBeDefined();
    expect(signalX).toBe(signalY);
    expect(registered.size).toBe(2);
  });

  it("rolls back partially-registered tools if a later registration throws a non-duplicate error", () => {
    const registered = new Map<string, RegisteredCall>();
    let callIndex = 0;
    const registerTool = vi.fn(
      (def: RegisteredCall, options?: RegisterOptions) => {
        callIndex += 1;
        if (callIndex === 2) {
          throw new Error("Some other registration failure");
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

    expect(() =>
      registerTools([
        { name: "ok", description: "first", execute: () => ({}) },
        { name: "boom", description: "second", execute: () => ({}) },
      ]),
    ).toThrow("Some other registration failure");
    // First registration was rolled back via the shared AbortController.
    expect(registered.has("ok")).toBe(false);
  });

  it("returns a no-op cleanup when WebMCP is unavailable", () => {
    const cleanup = registerTools([
      { name: "a", description: "A", execute: async () => ({}) },
    ]);
    expect(() => cleanup()).not.toThrow();
  });
});
