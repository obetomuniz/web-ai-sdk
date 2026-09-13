import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  type ExecuteToolOptions,
  executeTool,
  type RegisteredTool,
  WebMCPUnavailableError,
} from "./index.js";
import { executeTool as reactExecuteTool } from "./react/index.js";

const tool: RegisteredTool = {
  name: "consequential_action",
  description: "Count an action locally.",
  window,
  origin: window.location.origin,
  annotations: { consequentialHint: true },
};

const install = (execute: ReturnType<typeof vi.fn>, host = document) => {
  const mc = { executeTool: execute };
  Object.defineProperty(host, "modelContext", {
    configurable: true,
    value: mc,
  });
  return mc;
};

afterEach(() => {
  Reflect.deleteProperty(document, "modelContext");
  Reflect.deleteProperty(navigator, "modelContext");
});

// Mirror the verified Web IDL arities, independent of mock implementation.
const nativeMock = (arity: number) => {
  const execute = vi.fn();
  Object.defineProperty(execute, "length", { value: arity });
  return execute;
};

it("exposes object input and the same implementation through React", () => {
  expectTypeOf(executeTool).parameter(1).toEqualTypeOf<object | undefined>();
  expect(reactExecuteTool).toBe(executeTool);
});

describe.each([1, 2])("native executeTool arity %i", (arity) => {
  it.each([{}, { message: "hello" }, [1, { nested: true }]])(
    "invokes once with the selected input shape for %j",
    async (input) => {
      const execute = nativeMock(arity).mockResolvedValue('{"ok":true}');
      const mc = install(execute);
      const options = { signal: new AbortController().signal };
      await expect(executeTool(tool, input, options)).resolves.toBe(
        '{"ok":true}',
      );
      expect(execute).toHaveBeenCalledExactlyOnceWith(
        tool,
        arity === 1 ? input : JSON.stringify(input),
        options,
      );
      expect(execute.mock.contexts[0]).toBe(mc);
      expect(execute.mock.calls[0]?.[2]).toBe(options);
      if (arity === 1) expect(execute.mock.calls[0]?.[1]).toBe(input);
    },
  );

  it("defaults omitted and explicitly undefined input to an empty object", async () => {
    const execute = nativeMock(arity).mockResolvedValue("ok");
    install(execute);
    await executeTool(tool);
    await executeTool(tool, undefined);
    expect(execute.mock.calls).toEqual([
      [tool, arity === 1 ? {} : "{}", undefined],
      [tool, arity === 1 ? {} : "{}", undefined],
    ]);
  });

  it.each([null, "hello", 123, true, 1n, Symbol("input")])(
    "rejects non-object input before calling native: %s",
    async (input) => {
      const execute = nativeMock(arity);
      install(execute);
      // @ts-expect-error Verify rejection for untyped callers with primitive input.
      await expect(executeTool(tool, input)).rejects.toBeInstanceOf(TypeError);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it("accepts callable objects that produce JSON", async () => {
    const input = Object.assign(() => {}, { toJSON: () => ({ value: true }) });
    const execute = nativeMock(arity).mockImplementation(
      async (_tool, value) => {
        return arity === 1 ? JSON.stringify(value) : value;
      },
    );
    install(execute);
    await expect(executeTool(tool, input)).resolves.toBe('{"value":true}');
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[1]).toBe(
      arity === 1 ? input : '{"value":true}',
    );
  });

  it("serializes once, including stateful toJSON, and preserves navigation null", async () => {
    const toJSON = vi.fn(() => ({ count: toJSON.mock.calls.length }));
    const execute = nativeMock(arity).mockImplementation(
      async (_tool, input) => {
        const json = arity === 1 ? JSON.stringify(input) : input;
        expect(json).toBe('{"count":1}');
        return null;
      },
    );
    install(execute);
    await expect(executeTool(tool, { toJSON })).resolves.toBeNull();
    expect(toJSON).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
  });

  it.each([
    "circular",
    "bigint",
    "callable",
    "undefined",
    "symbol",
    "function",
    "throw",
  ])(
    "rejects serialization failure (%s) without executing an action",
    async (kind) => {
      const thrown = new Error("toJSON failure");
      const circular: { self?: object } = {};
      circular.self = circular;
      const input =
        kind === "circular"
          ? circular
          : kind === "callable"
            ? () => {}
            : kind === "bigint"
              ? { value: 1n }
              : {
                  toJSON: () => {
                    if (kind === "throw") throw thrown;
                    if (kind === "symbol") return Symbol("input");
                    if (kind === "function") return () => {};
                    return undefined;
                  },
                };
      const action = vi.fn();
      const execute = nativeMock(arity).mockImplementation(
        async (_tool, value) => {
          // Object-input Blink performs this validation before dispatching.
          if (arity === 1 && JSON.stringify(value) === undefined)
            throw new TypeError("Invalid JSON");
          action();
          return "ok";
        },
      );
      install(execute);
      const pending = executeTool(tool, input);
      if (kind === "throw") await expect(pending).rejects.toBe(thrown);
      else await expect(pending).rejects.toBeInstanceOf(TypeError);
      expect(execute).toHaveBeenCalledTimes(arity === 1 ? 1 : 0);
      expect(action).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "never retries after a consequential action fails (sync: %s)",
    async (sync) => {
      const error = new TypeError("Failure after the action already ran");
      let actions = 0;
      const execute = nativeMock(arity).mockImplementation(() => {
        actions++;
        if (sync) throw error;
        return Promise.reject(error);
      });
      install(execute);
      await expect(executeTool(tool, {})).rejects.toBe(error);
      expect(execute).toHaveBeenCalledOnce();
      expect(actions).toBe(1);
    },
  );

  it.each([false, true])(
    "preserves native cancellation (already aborted: %s)",
    async (aborted) => {
      const controller = new AbortController();
      const reason = new DOMException("Cancelled", "AbortError");
      const execute = nativeMock(arity).mockImplementation(
        (_tool, _input, options: ExecuteToolOptions) =>
          new Promise((_resolve, reject) => {
            const signal = options.signal;
            if (signal?.aborted) reject(signal.reason);
            else
              signal?.addEventListener("abort", () => reject(signal.reason), {
                once: true,
              });
          }),
      );
      install(execute);
      if (aborted) controller.abort(reason);
      const pending = executeTool(tool, {}, { signal: controller.signal });
      controller.abort(reason);
      await expect(pending).rejects.toBe(reason);
      expect(execute).toHaveBeenCalledOnce();
    },
  );

  it("supports the legacy navigator entry point", async () => {
    const execute = nativeMock(arity).mockResolvedValue("ok");
    Object.defineProperty(navigator, "modelContext", {
      configurable: true,
      value: { executeTool: execute },
    });
    await expect(executeTool(tool)).resolves.toBe("ok");
    expect(execute).toHaveBeenCalledOnce();
  });
});

it.each([0, 3])(
  "rejects unverified arity %i without invoking or serializing",
  async (arity) => {
    const execute = nativeMock(arity);
    const toJSON = vi.fn();
    install(execute);
    await expect(executeTool(tool, { toJSON })).rejects.toBeInstanceOf(
      WebMCPUnavailableError,
    );
    expect(execute).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
  },
);
