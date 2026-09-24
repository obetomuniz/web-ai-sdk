import { expect, it, vi } from "vitest";
import { runDispatcher } from "./dispatcher.js";
import type { AgentEvent, AgentToolContext } from "./types.js";

it("finishes cancellation without accepting late output or progress", async () => {
  const controller = new AbortController();
  let finish!: (value: string) => void;
  let context!: AgentToolContext;
  const events: AgentEvent[] = [];
  const execute = vi.fn((_input: unknown, ctx: AgentToolContext) => {
    context = ctx;
    return new Promise<string>((resolve) => {
      finish = resolve;
    });
  });
  const stream = runDispatcher({
    tools: [
      {
        name: "slow",
        description: "Slow test tool",
        inputSchema: { type: "object" },
        execute,
      },
    ],
    calls: [{ name: "slow", input: {} }],
    stepIndex: 0,
    signal: controller.signal,
  });
  const consume = (async () => {
    for await (const event of stream) events.push(event);
  })();
  await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
  controller.abort();
  await consume;
  expect(events.at(-1)).toMatchObject({
    type: "tool_result",
    error: { name: "AbortError" },
  });
  const count = events.length;
  context.emit("late progress");
  finish("late success");
  await Promise.resolve();
  expect(events).toHaveLength(count);
  expect(
    events.some((event) => event.type === "tool_result" && event.output),
  ).toBe(false);
});
