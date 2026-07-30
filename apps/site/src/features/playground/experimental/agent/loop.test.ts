import type { Session } from "@web-ai-sdk/prompt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildNativePrompt, createAgentLoop } from "./loop.js";
import type { AgentTool } from "./types.js";

const { createSessionMock } = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
}));

vi.mock("@web-ai-sdk/prompt", () => {
  class PromptAbortError extends Error {
    override readonly name = "AbortError";
  }

  class PromptUnavailableError extends Error {
    override readonly name = "PromptUnavailableError";
  }

  return {
    createSession: createSessionMock,
    isAvailable: () => true,
    PromptAbortError,
    PromptUnavailableError,
  };
});

beforeEach(() => {
  createSessionMock.mockReset();
});

describe("buildNativePrompt", () => {
  it("requires direct, evidence-calibrated answers from every agent", () => {
    const prompt = buildNativePrompt("You are a friendly assistant.", []);

    expect(prompt).toContain("accuracy over agreement");
    expect(prompt).toContain("actual question directly");
    expect(prompt).toContain("supports it with high confidence");
    expect(prompt).toContain("unsupported model memory as low confidence");
    expect(prompt).toContain("historical membership");
    expect(prompt).toContain("unverified claims, not evidence");
    expect(prompt).toContain("do not guess or select an option");
    expect(prompt).toContain("without automatically reversing");
    expect(prompt).toContain("Never say the user is correct");
  });
});

describe("createAgentLoop", () => {
  it("continues a mixed request after eager URL fetches until clock_now executes", async () => {
    const fixture = createSessionFixture([
      "Both URLs were fetched successfully.",
      "```tool_code\nclock_now()\n```",
      "Both pages are available, and the current time is 12:34.",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const tools: AgentTool[] = [
      createFetchFixtureTool(calls),
      createClockFixtureTool(calls),
    ];
    const agent = createAgentLoop({ tools });

    const result = await agent.run(
      "Fetch https://one.test and https://two.test, then call clock_now to give me the current time.",
    );
    agent.destroy();

    expect(calls).toEqual(["fetch_url", "fetch_url", "clock_now"]);
    expect(result.stopReason).toBe("done");
    expect(result.text).toContain("12:34");
  });

  it("keeps fetch-only requests on the existing single-answer path", async () => {
    const fixture = createSessionFixture(["Fetch-only answer."]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const agent = createAgentLoop({
      tools: [createFetchFixtureTool(calls), createClockFixtureTool(calls)],
    });

    const result = await agent.run("Fetch https://one.test and summarize it.");
    agent.destroy();

    expect(calls).toEqual(["fetch_url"]);
    expect(fixture.inputs).toHaveLength(1);
    expect(result).toMatchObject({
      stopReason: "done",
      text: "Fetch-only answer.",
    });
  });

  it("reports explicitly requested tool work that remains uncalled", async () => {
    const fixture = createSessionFixture([
      "The URLs are done.",
      "Here is the final answer.",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const agent = createAgentLoop({
      tools: [createFetchFixtureTool(calls), createClockFixtureTool(calls)],
    });

    const result = await agent.run(
      "Fetch https://one.test, then call clock_now for the current time.",
    );
    agent.destroy();

    expect(calls).toEqual(["fetch_url"]);
    expect(fixture.inputs).toHaveLength(2);
    expect(result.stopReason).toBe("done");
    expect(result.text).toContain("clock_now was not called");
  });

  it("reports explicitly requested tool work that fails", async () => {
    const fixture = createSessionFixture([
      "```tool_code\nclock_now()\n```",
      "Everything completed.",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const agent = createAgentLoop({
      tools: [
        createFetchFixtureTool(calls),
        createClockFixtureTool(calls, new Error("Clock unavailable")),
      ],
    });

    const result = await agent.run(
      "Fetch https://one.test, then call clock_now for the current time.",
    );
    agent.destroy();

    expect(calls).toEqual(["fetch_url", "clock_now"]);
    expect(result.stopReason).toBe("done");
    expect(result.text).toContain("clock_now failed: Clock unavailable");
  });

  it("uses the existing step budget for the remaining-tool correction", async () => {
    const fixture = createSessionFixture(["The URLs are done."]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const agent = createAgentLoop({
      tools: [createFetchFixtureTool(calls), createClockFixtureTool(calls)],
      maxSteps: 2,
    });

    const result = await agent.run(
      "Fetch https://one.test, then call clock_now for the current time.",
    );
    agent.destroy();

    expect(fixture.inputs).toHaveLength(1);
    expect(result.stopReason).toBe("budget_exhausted");
    expect(result.text).toContain("clock_now was not called");
    expect(result.failure?.name).toBe("AgentIncompleteToolRequestError");
  });
});

function createFetchFixtureTool(
  calls: string[],
): AgentTool<{ url: string }, { status: number; url: string; text: string }> {
  return {
    name: "fetch_url",
    description: "Fetch a URL.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
    async execute({ url }) {
      calls.push("fetch_url");
      return { status: 200, url, text: `Content from ${url}` };
    },
  };
}

function createClockFixtureTool(
  calls: string[],
  failure?: Error,
): AgentTool<Record<string, never>, { formatted: string }> {
  return {
    name: "clock_now",
    description: "Return the current time.",
    inputSchema: { type: "object" },
    async execute() {
      calls.push("clock_now");
      if (failure) throw failure;
      return { formatted: "12:34" };
    },
  };
}

function createSessionFixture(replies: readonly string[]): {
  base: Session;
  inputs: string[];
} {
  let replyIndex = 0;
  const inputs: string[] = [];

  const create = (): Session => {
    let destroyed = false;
    return {
      get destroyed() {
        return destroyed;
      },
      async send(input) {
        inputs.push(String(input));
        return replies[replyIndex++] ?? null;
      },
      async *sendStreaming(input) {
        inputs.push(String(input));
        const reply = replies[replyIndex++];
        if (reply === undefined) {
          throw new Error("Fixture ran out of model replies.");
        }
        yield reply;
      },
      abort() {},
      async clone() {
        return create();
      },
      async append() {},
      onContextOverflow() {
        return () => {};
      },
      destroy() {
        destroyed = true;
      },
    };
  };

  return { base: create(), inputs };
}
