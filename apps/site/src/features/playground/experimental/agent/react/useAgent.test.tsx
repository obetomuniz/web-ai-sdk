// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { writeTool } from "../tools/write.js";
import { type UseAgentReturn, useAgent } from "./useAgent.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

const tools = [writeTool];
function mount() {
  const div = document.createElement("div");
  document.body.append(div);
  root = createRoot(div);
  let result!: UseAgentReturn;
  function Harness({ sessionKey }: { sessionKey: string }) {
    result = useAgent({
      tools,
      sessionMode: "thread",
      sessionKey,
    });
    return <p>{result.text}</p>;
  }
  act(() => root?.render(<Harness sessionKey="A" />));
  return {
    get current() {
      return result;
    },
    switch: () => act(() => root?.render(<Harness sessionKey="B" />)),
  };
}
function installPrompt(
  reply = '```tool_code\nwrite_text(task="Draft an email")\n```',
) {
  const native = {
    promptStreaming: async function* () {
      yield reply;
    },
    destroy: vi.fn(),
    clone: vi.fn(async () => native),
  };
  const create = vi.fn(async () => native);
  vi.stubGlobal("LanguageModel", {
    create,
    availability: async () => "available",
  });
  return create;
}

it.each(["mode change", "unmount"])(
  "releases pending tool preparation on %s without stale output",
  async (cleanup) => {
    const promptCreate = installPrompt();
    let resolve!: (value: object) => void;
    const destroy = vi.fn();
    const write = vi.fn(async () => "Late answer");
    const create = vi.fn(
      () =>
        new Promise<object>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("Writer", { availability: async () => "available", create });
    const hook = mount();
    expect(promptCreate).not.toHaveBeenCalled();
    let running!: ReturnType<UseAgentReturn["run"]>;
    await act(async () => {
      running = hook.current.run("Draft an email");
      await new Promise((done) => setTimeout(done, 10));
    });
    expect(create).toHaveBeenCalledOnce();
    if (cleanup === "unmount")
      act(() => {
        root?.unmount();
        root = undefined;
      });
    else hook.switch();
    let turn: Awaited<typeof running>;
    await act(async () => {
      turn = await running;
    });
    expect(turn?.stopReason).toBe("aborted");
    expect(turn?.steps.flatMap((step) => step.toolCalls)).toEqual([
      expect.objectContaining({
        name: "write_text",
        error: expect.objectContaining({ name: "AbortError" }),
      }),
    ]);
    await act(async () => {
      resolve({ write, destroy });
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(destroy).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("Late answer");
  },
);

it("keeps a completed invocation's late abort isolated from the next run", async () => {
  installPrompt("44");
  const hook = mount();
  const first = new AbortController();
  let a: Awaited<ReturnType<UseAgentReturn["run"]>>;
  await act(async () => {
    a = await hook.current.run("40 + 4", { signal: first.signal });
  });
  expect(a?.assistantText).toBe("44");
  let b: Awaited<ReturnType<UseAgentReturn["run"]>>;
  await act(async () => {
    const running = hook.current.run("Only the result");
    first.abort();
    b = await running;
  });
  expect(b?.stopReason).toBe("done");
  expect(b?.assistantText).toBe("44");
});
