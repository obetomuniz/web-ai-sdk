import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defineTool,
  isAvailable,
  registerTool,
  type StandardSchemaV1,
  ToolValidationError,
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

type Host = "document" | "navigator";

const setModelContext = (host: Host, value: unknown) => {
  Object.defineProperty(
    host === "document" ? document : navigator,
    "modelContext",
    { value, configurable: true },
  );
};

/**
 * Mirror the native WebMCP shape: a single `registerTool(def, { signal? })`
 * method. There is no `unregisterTool`; cleanup happens by aborting the signal
 * that was passed at registration. Installs on `navigator` by default; pass
 * `host: "document"` to mount on `document.modelContext` instead.
 */
const installFakeModelContext = (host: Host = "navigator") => {
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
    await Promise.resolve(); // flush microtask; if the throw survived it would surface here

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/could not be registered after retry/),
    );
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
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
