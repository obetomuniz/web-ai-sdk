import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  type DefineToolOptions,
  defineTool,
  executeTool,
  getTools,
  isAvailable,
  type RegisteredTool,
  type RegisterToolOptions,
  registerTool,
  type StandardSchemaV1,
  subscribeToToolChanges,
  type Tool,
  type ToolDefinition,
  ToolOutputValidationError,
  ToolValidationError,
  WebMCPUnavailableError,
} from "./index.js";

interface RegisteredCall {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: Record<string, boolean>;
  execute: (input: unknown) => unknown;
}

interface NativeRegisterOptions {
  signal?: AbortSignal;
  exposedTo?: readonly string[];
}

type Host = "document" | "navigator";

const setModelContext = (host: Host, value: unknown) => {
  Object.defineProperty(
    host === "document" ? document : navigator,
    "modelContext",
    { value, configurable: true },
  );
};

/** Flush all pending microtasks (the async register pipeline chains several). */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Mirror the native WebMCP shape: a single `registerTool(def, { signal? })`
 * method. There is no `unregisterTool`; cleanup happens by aborting the signal
 * that was passed at registration. Installs on `navigator` by default; pass
 * `host: "document"` to mount on `document.modelContext` instead.
 *
 * By default mirrors the spec-current async shape: `registerTool` returns a
 * `Promise<void>`. The promise executor runs synchronously (so
 * `registered.set(...)` is visible in the same tick), but the settle
 * (resolve/reject) is observed on a later microtask. Pass `{ sync: true }`
 * for the legacy synchronous shape (throws synchronously, returns
 * `undefined`).
 */
const installFakeModelContext = (
  host: Host = "navigator",
  { sync = false }: { sync?: boolean } = {},
) => {
  const registered = new Map<string, RegisteredCall>();
  const dup = () =>
    new Error(
      "Failed to execute 'registerTool' on 'ModelContext': Duplicate tool name",
    );
  const apply = (def: RegisteredCall, options?: NativeRegisterOptions) => {
    if (registered.has(def.name)) throw dup();
    registered.set(def.name, def);
    options?.signal?.addEventListener("abort", () => {
      registered.delete(def.name);
    });
  };
  const registerTool = vi.fn(
    (def: RegisteredCall, options?: NativeRegisterOptions) => {
      if (sync) {
        apply(def, options); // legacy: throws synchronously, returns undefined
        return undefined;
      }
      // Spec-current shape: returns a Promise. Executor is sync (mutations
      // visible same tick), but settle is observed on a later microtask.
      return new Promise<void>((resolve, reject) => {
        try {
          apply(def, options);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    },
  );

  const mc = { registerTool };
  setModelContext(host, mc);

  return { mc, registered, registerTool };
};

afterEach(() => {
  setModelContext("document", undefined);
  setModelContext("navigator", undefined);
});

describe("feature detection", () => {
  it("isAvailable() is false when modelContext is missing on both hosts", () => {
    expect(isAvailable()).toBe(false);
  });

  it("isAvailable() is true when navigator.modelContext is present", () => {
    installFakeModelContext("navigator");
    expect(isAvailable()).toBe(true);
  });

  it("isAvailable() is true when document.modelContext is present", () => {
    installFakeModelContext("document");
    expect(isAvailable()).toBe(true);
  });

  it("prefers document.modelContext over navigator.modelContext when both are present", () => {
    const onDoc = installFakeModelContext("document");
    const onNav = installFakeModelContext("navigator");

    registerTool({
      name: "ping",
      description: "Returns pong.",
      execute: async () => ({ result: "pong" }),
    });

    expect(onDoc.registerTool).toHaveBeenCalledTimes(1);
    expect(onNav.registerTool).not.toHaveBeenCalled();
  });
});

describe("tool discovery and execution", () => {
  const discoveredTool = (): RegisteredTool => ({
    name: "echo",
    title: "Echo",
    description: "Echo a value.",
    inputSchema: '{"type":"object"}',
    window,
    origin: window.location.origin,
    annotations: { readOnlyHint: true },
  });

  it("returns an empty list when discovery is unavailable", async () => {
    await expect(getTools()).resolves.toEqual([]);
  });

  it("forwards discovery options and preserves native metadata", async () => {
    const tool = discoveredTool();
    const getNativeTools = vi.fn(async () => [tool]);
    setModelContext("document", {
      registerTool: vi.fn(),
      getTools: getNativeTools,
    });

    await expect(
      getTools({ fromOrigins: ["https://agent.example"] }),
    ).resolves.toEqual([tool]);
    expect(getNativeTools).toHaveBeenCalledWith({
      fromOrigins: ["https://agent.example"],
    });
  });

  it("serializes input and forwards execution options", async () => {
    const tool = discoveredTool();
    const executeNativeTool = vi.fn(async () => '{"echoed":"hello"}');
    setModelContext("document", {
      registerTool: vi.fn(),
      executeTool: executeNativeTool,
    });
    const controller = new AbortController();

    await expect(
      executeTool(tool, { message: "hello" }, { signal: controller.signal }),
    ).resolves.toBe('{"echoed":"hello"}');
    expect(executeNativeTool).toHaveBeenCalledWith(
      tool,
      '{"message":"hello"}',
      { signal: controller.signal },
    );
  });

  it("rejects execution when the native capability is unavailable", async () => {
    await expect(executeTool(discoveredTool())).rejects.toBeInstanceOf(
      WebMCPUnavailableError,
    );
  });

  it("subscribes to tool changes and returns idempotent cleanup", () => {
    const events = new EventTarget();
    setModelContext("document", {
      registerTool: vi.fn(),
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    });
    const listener = vi.fn();
    const cleanup = subscribeToToolChanges(listener);

    events.dispatchEvent(new Event("toolchange"));
    expect(listener).toHaveBeenCalledOnce();

    cleanup();
    cleanup();
    events.dispatchEvent(new Event("toolchange"));
    expect(listener).toHaveBeenCalledOnce();
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

  it("forwards name/description/execute to the host modelContext", async () => {
    const { registered, registerTool: spy } = installFakeModelContext();

    registerTool({
      name: "ping",
      description: "Returns pong.",
      execute: async () => ({ result: "pong" }),
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const def = registered.get("ping");
    expect(def?.name).toBe("ping");
    expect(def).not.toHaveProperty("title");
    expect(def?.description).toBe("Returns pong.");
    await expect(def?.execute(undefined)).resolves.toEqual({ result: "pong" });
  });

  it("forwards title when present", () => {
    const { registerTool: spy } = installFakeModelContext();
    const execute = async () => ({ result: "pong" });

    registerTool({
      name: "ping",
      title: "Ping the server",
      description: "Returns pong.",
      execute,
    });

    expect(spy.mock.calls[0]?.[0]).toEqual({
      name: "ping",
      title: "Ping the server",
      description: "Returns pong.",
      execute,
    });
  });

  it("passes an AbortSignal through to registerTool", () => {
    const { registerTool: spy } = installFakeModelContext();
    registerTool({
      name: "with-signal",
      description: "x",
      execute: async () => ({}),
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const options = spy.mock.calls[0]?.[1] as NativeRegisterOptions | undefined;
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.signal?.aborted).toBe(false);
    expect(options).not.toHaveProperty("exposedTo");
  });

  it("forwards exposedTo unchanged alongside the owned signal", () => {
    const { registerTool: spy } = installFakeModelContext();
    const exposedTo = ["https://agent.example"] as const;

    registerTool(
      {
        name: "shared",
        description: "Shared with an embedded agent.",
        execute: async () => ({}),
      },
      { exposedTo },
    );

    const options = spy.mock.calls[0]?.[1] as NativeRegisterOptions | undefined;
    expect(options).toEqual({
      signal: expect.any(AbortSignal),
      exposedTo,
    });
    expect(options?.exposedTo).toBe(exposedTo);
  });

  it("remains compatible with tools.map(registerTool)", () => {
    const { registered, registerTool: spy } = installFakeModelContext();
    const tools = [
      { name: "first", description: "First", execute: async () => ({}) },
      { name: "second", description: "Second", execute: async () => ({}) },
    ];

    const cleanups: Array<() => void> = tools.map(registerTool);

    expect(registered.size).toBe(2);
    expect(spy.mock.calls[0]?.[1]).not.toHaveProperty("exposedTo");
    expect(spy.mock.calls[1]?.[1]).not.toHaveProperty("exposedTo");
    for (const cleanup of cleanups) cleanup();
    expect(registered.size).toBe(0);
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

  it("forwards an explicit false untrustedContentHint", () => {
    const { registered } = installFakeModelContext();
    registerTool({
      name: "external-search",
      description: "Searches an external source.",
      annotations: { untrustedContentHint: false },
      execute: async () => ({}),
    });
    expect(registered.get("external-search")?.annotations).toEqual({
      untrustedContentHint: false,
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

  it("evicts a prior live registration for the same name (last writer wins)", async () => {
    const { registered } = installFakeModelContext();
    const cleanupA = registerTool({
      name: "shared",
      description: "first",
      execute: () => ({ which: "A" }),
    });
    // Let A's registration settle so its ownership is tracked before B runs.
    await flush();
    expect(registered.get("shared")?.description).toBe("first");

    // Fresh call for the same name. The prior controller should be aborted
    // (which removes the first registration) so this one can take the slot.
    const cleanupB = registerTool({
      name: "shared",
      description: "second",
      execute: () => ({ which: "B" }),
    });
    await flush();
    expect(registered.get("shared")?.description).toBe("second");

    // The first caller's cleanup is a no-op now (its controller was already
    // aborted by the second call).
    cleanupA();
    expect(registered.get("shared")?.description).toBe("second");

    // The second caller's cleanup removes the tool.
    cleanupB();
    expect(registered.has("shared")).toBe(false);
  });

  it("same-tick double-register of one name degrades to warn-and-skip (first wins)", async () => {
    const { registered } = installFakeModelContext();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // No flush between the two calls: neither registration has settled, so
    // neither sees the other in ownedControllers and no eviction happens.
    registerTool({
      name: "tick",
      description: "first",
      execute: async () => ({}),
    });
    registerTool({
      name: "tick",
      description: "second",
      execute: async () => ({}),
    });
    await flush();

    expect(registered.get("tick")?.description).toBe("first");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/already registered by another caller/),
    );
    expect(errorSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
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
    await flush();
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
    await flush(); // flush the async register pipeline
    expect(map.has("t")).toBe(true); // retry landed it
    expect(registerTool_).toHaveBeenCalledTimes(2);
  });

  it("logs and gives up (no uncaught throw) when the retry fails with a non-duplicate error", async () => {
    let calls = 0;
    const registerTool_ = vi.fn(() => {
      calls += 1;
      // First call: duplicate (enters the microtask retry path). Retry
      // call: a non-duplicate failure that the old code re-threw from
      // inside queueMicrotask (uncaught by construction).
      if (calls === 1) {
        throw new Error(
          "Failed to execute 'registerTool' on 'ModelContext': Duplicate tool name",
        );
      }
      throw new Error("InvalidStateError: sandbox unavailable");
    });
    Object.defineProperty(navigator, "modelContext", {
      value: { registerTool: registerTool_ },
      configurable: true,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      registerTool({ name: "t", description: "d", execute: async () => ({}) }),
    ).not.toThrow();
    await flush(); // flush the async register pipeline; if the throw survived it would surface here

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/could not be registered after retry/),
    );
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("logs and gives up (no throw) when the FIRST call fails with a non-duplicate error", async () => {
    const registerTool_ = vi.fn(() =>
      Promise.reject(new Error("InvalidStateError: sandbox unavailable")),
    );
    Object.defineProperty(navigator, "modelContext", {
      value: { registerTool: registerTool_ },
      configurable: true,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      registerTool({ name: "t", description: "d", execute: async () => ({}) }),
    ).not.toThrow();
    await flush();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/could not be registered:/),
    );
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("treats abort-during-pending registration as a clean cancellation (no error/warn)", async () => {
    const registerTool_ = vi.fn(
      (_def: RegisteredCall, options?: NativeRegisterOptions) =>
        new Promise<void>((_resolve, reject) => {
          // Never resolves on its own; only rejects when aborted.
          options?.signal?.addEventListener("abort", () => {
            reject(
              new DOMException("The user aborted a request.", "AbortError"),
            );
          });
        }),
    );
    Object.defineProperty(navigator, "modelContext", {
      value: { registerTool: registerTool_ },
      configurable: true,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const cleanup = registerTool({
      name: "x",
      description: "x",
      execute: async () => ({}),
    });
    cleanup(); // abort before the pending registration settles
    await flush();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("handles the legacy synchronous-throw shape (callRegister normalizes it)", async () => {
    const { registered } = installFakeModelContext("navigator", {
      sync: true,
    });
    registerTool({
      name: "sync",
      description: "old chrome",
      execute: async () => ({}),
    });
    await flush();
    expect(registered.has("sync")).toBe(true);
  });
});

describe("Standard Schema tool definitions", () => {
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

  const numericStringSchema: StandardSchemaV1<string, number> = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value: unknown) => {
        if (typeof value === "string" && /^\d+$/.test(value)) {
          return { value: Number(value) };
        }
        return {
          issues: [
            {
              message: "output must be a numeric string",
              path: ["value"],
            },
          ],
        };
      },
      types: { input: "" as string, output: 0 as number },
    },
  };

  it("accepts schemas directly and passes transformed input to execute", async () => {
    const { registered } = installFakeModelContext();
    const execute = vi.fn((count: number) => String(count + 1));

    registerTool({
      name: "increment",
      description: "increments a numeric string",
      input: numericStringSchema,
      inputSchema: { type: "string", pattern: "^\\d+$" },
      execute: (count) => {
        expectTypeOf(count).toEqualTypeOf<number>();
        return execute(count);
      },
    });

    await expect(registered.get("increment")?.execute("41")).resolves.toBe(
      "42",
    );
    expect(execute).toHaveBeenCalledWith(41);
  });

  it("validates transformed outputs from synchronous and asynchronous schemas", async () => {
    const { registered } = installFakeModelContext();
    const asyncOutput: StandardSchemaV1<string, number> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: async (value: unknown) => {
          await Promise.resolve();
          return numericStringSchema["~standard"].validate(value);
        },
        types: { input: "" as string, output: 0 as number },
      },
    };

    registerTool({
      name: "count",
      description: "returns a count",
      output: asyncOutput,
      execute: async () => "42",
    });

    await expect(registered.get("count")?.execute(undefined)).resolves.toBe(42);
  });

  it("preserves typed input validation errors without validate ceremony", async () => {
    const { registered } = installFakeModelContext();
    const execute = vi.fn(() => ({ ok: true }));

    registerTool({
      name: "increment",
      description: "increments a numeric string",
      input: numericStringSchema,
      execute,
    });

    await expect(
      registered.get("increment")?.execute("not-a-number"),
    ).rejects.toMatchObject({
      name: "ToolValidationError",
      toolName: "increment",
      issues: [{ message: "output must be a numeric string" }],
    });
    await expect(
      registered.get("increment")?.execute("not-a-number"),
    ).rejects.toBeInstanceOf(ToolValidationError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("preserves typed output validation errors", async () => {
    const { registered } = installFakeModelContext();

    registerTool({
      name: "count",
      description: "returns a count",
      output: numericStringSchema,
      execute: () => "not-a-number",
    });

    await expect(
      registered.get("count")?.execute(undefined),
    ).rejects.toMatchObject({
      name: "ToolOutputValidationError",
      toolName: "count",
      issues: [{ message: "output must be a numeric string" }],
    });
  });

  it("never forwards SDK-only schemas while retaining native metadata", () => {
    const { registerTool: nativeRegister } = installFakeModelContext();
    const annotations = { idempotentHint: true } as const;
    const inputSchema = { type: "string" };
    const exposedTo = ["https://agent.example"] as const;

    registerTool(
      {
        name: "echo",
        title: "Echo text",
        description: "echoes",
        input: stringSchema("input"),
        output: stringSchema("output"),
        inputSchema,
        readOnly: true,
        annotations,
        execute: (text) => text,
      },
      { exposedTo },
    );

    const definition = nativeRegister.mock.calls[0]?.[0];
    const options = nativeRegister.mock.calls[0]?.[1];
    expect(definition).toMatchObject({
      name: "echo",
      title: "Echo text",
      description: "echoes",
      inputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    });
    expect(definition).not.toHaveProperty("input");
    expect(definition).not.toHaveProperty("output");
    expect(options?.exposedTo).toBe(exposedTo);
  });

  it("accepts heterogeneous schema definitions without a Tool[] cast", () => {
    const { registered } = installFakeModelContext();
    const textTool = {
      name: "text",
      description: "returns text",
      input: stringSchema("input"),
      execute: (text) => {
        expectTypeOf(text).toEqualTypeOf<string>();
        return text;
      },
    } satisfies ToolDefinition<StandardSchemaV1<string, string>, string>;
    const numberTool = {
      name: "number",
      description: "returns a number",
      input: numericStringSchema,
      execute: (count) => {
        expectTypeOf(count).toEqualTypeOf<number>();
        return count;
      },
    } satisfies ToolDefinition<StandardSchemaV1<string, number>, number>;
    const tools = [textTool, numberTool] as const;

    const cleanups = tools.map(registerTool);

    expect(registered.has("text")).toBe(true);
    expect(registered.has("number")).toBe(true);
    for (const cleanup of cleanups) cleanup();
  });

  it("keeps defineTool as an opt-in-validation compatibility wrapper", async () => {
    const tool = defineTool({
      name: "echo",
      description: "echoes",
      input: stringSchema("input"),
      execute: (text) => ({ text }),
    });
    const out = await (tool.execute as (input: unknown) => unknown)(123);
    expect(out).toEqual({ text: 123 });
  });

  it("returns a Tool that registers via the existing surface", () => {
    const { registered } = installFakeModelContext();
    const tool = defineTool({
      name: "echo",
      title: "Echo text",
      description: "echoes",
      input: stringSchema("input"),
      inputSchema: { type: "string" },
      execute: (text) => ({ text }),
    });
    registerTool(tool);
    expect(registered.get("echo")?.title).toBe("Echo text");
    expect(registered.get("echo")?.inputSchema).toEqual({ type: "string" });
  });

  it("preserves the public metadata and registration option types", () => {
    const tool = defineTool({
      name: "external-search",
      title: "External search",
      description: "Searches an external source.",
      annotations: { untrustedContentHint: true },
      execute: () => ({ results: [] }),
    });
    const exposedTo = ["https://agent.example"] as const;
    const options = { exposedTo } satisfies RegisterToolOptions;

    expectTypeOf(tool.title).toEqualTypeOf<string | undefined>();
    expectTypeOf(options.exposedTo).toEqualTypeOf<
      readonly ["https://agent.example"]
    >();
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

  it("preserves the existing explicit DefineToolOptions generic order", () => {
    type InputSchema = StandardSchemaV1<string, string>;
    type Output = { text: string };
    const options: DefineToolOptions<InputSchema, Output> = {
      name: "echo",
      description: "echoes",
      input: stringSchema("input"),
      execute: (text) => ({ text }),
    };
    const tool = defineTool<InputSchema, Output>(options);
    const acceptsExistingTool = (_tool: Tool<string, Output>): void => {};

    acceptsExistingTool(tool);
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

  it("validates a synchronous result with a synchronous output schema", async () => {
    const validate = vi.fn((value: unknown) => {
      if (typeof value === "string") return { value: value.toUpperCase() };
      return { issues: [{ message: "output must be a string" }] };
    });
    const output: StandardSchemaV1<string, string> = {
      "~standard": { version: 1, vendor: "test", validate },
    };
    const tool = defineTool({
      name: "greet",
      description: "greets",
      output,
      execute: () => "hello",
    });

    await expect(tool.execute(undefined)).resolves.toBe("HELLO");
    expect(validate).toHaveBeenCalledWith("hello");
  });

  it("supports asynchronous results and asynchronous output validators", async () => {
    const output: StandardSchemaV1<string, string> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: async (value: unknown) => {
          await Promise.resolve();
          return typeof value === "string"
            ? { value: `${value}!` }
            : { issues: [{ message: "output must be a string" }] };
        },
      },
    };
    const tool = defineTool({
      name: "async-greet",
      description: "greets asynchronously",
      output,
      execute: async () => {
        await Promise.resolve();
        return "hello";
      },
    });

    await expect(tool.execute(undefined)).resolves.toBe("hello!");
  });

  it("returns schema transformations with the inferred output type", async () => {
    const tool = defineTool({
      name: "count",
      description: "returns a count",
      output: numericStringSchema,
      execute: () => "42",
    });

    const result = await tool.execute(undefined);
    expect(result).toBe(42);
    expectTypeOf(result).toEqualTypeOf<number>();
  });

  it("throws ToolOutputValidationError with the tool name and issues", async () => {
    const tool = defineTool({
      name: "count",
      description: "returns a count",
      output: numericStringSchema,
      execute: () => "not-a-number",
    });

    await expect(tool.execute(undefined)).rejects.toMatchObject({
      name: "ToolOutputValidationError",
      toolName: "count",
      issues: [
        {
          message: "output must be a numeric string",
          path: ["value"],
        },
      ],
    });
    await expect(tool.execute(undefined)).rejects.toBeInstanceOf(
      ToolOutputValidationError,
    );
  });

  it("passes execute rejections through without running output validation", async () => {
    const failure = new Error("request failed");
    const validate = vi.fn((value: unknown) => ({ value: String(value) }));
    const output: StandardSchemaV1<string, string> = {
      "~standard": { version: 1, vendor: "test", validate },
    };
    const tool = defineTool({
      name: "failing",
      description: "fails",
      output,
      execute: async () => {
        throw failure;
      },
    });

    await expect(tool.execute(undefined)).rejects.toBe(failure);
    expect(validate).not.toHaveBeenCalled();
  });

  it("does not forward an outputSchema field to WebMCP", () => {
    const { registered } = installFakeModelContext();
    const tool = defineTool({
      name: "count",
      description: "returns a count",
      output: numericStringSchema,
      execute: () => "42",
    });
    registerTool(tool);

    expect(registered.get("count")).not.toHaveProperty("outputSchema");
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

  it("preserves synchronous results and output inference without output", () => {
    const tool = defineTool({
      name: "plain",
      description: "plain",
      execute: () => ({ ok: true as const }),
    });
    const acceptsInferredTool = (
      _tool: Tool<unknown, { readonly ok: true }>,
    ): void => {};

    acceptsInferredTool(tool);
    expect(tool.execute(undefined)).toEqual({ ok: true });
    expect(tool.execute(undefined)).not.toBeInstanceOf(Promise);
  });
});
