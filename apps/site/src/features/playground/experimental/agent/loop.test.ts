import type { Session } from "@web-ai-sdk/prompt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildNativePrompt, createAgentLoop } from "./loop.js";
import { clockNowTool } from "./tools/clock.js";
import type { AgentTool, AgentToolContext } from "./types.js";

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
  it("does not present a Prompt-only answer as an SDK demonstration", async () => {
    const fixture = createSessionFixture([
      "Here is my generated draft.",
      "Here is my generated draft again.",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const agent = createAgentLoop({
      tools: [createClockFixtureTool([])],
      requireToolResult: true,
    });
    const result = await agent.run("Draft a message");
    agent.destroy();
    expect(fixture.inputs[1]).toContain("Do not answer in prose");
    expect(result.stopReason).toBe("tool_error");
    expect(result.text).toContain("No specialized tool completed");
    expect(result.text).not.toContain("generated draft");
  });

  it("steers one prose answer toward the matching specialized tool", async () => {
    const fixture = createSessionFixture([
      "Here is my generated draft.",
      "```tool_code\ndraft_fixture()\n```",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const agent = createAgentLoop({
      requireToolResult: true,
      tools: [
        {
          name: "draft_fixture",
          description: "Draft text.",
          inputSchema: { type: "object" },
          returnDirect: true,
          execute: async () => "Drafted by the Writer.",
        },
      ],
    });
    const result = await agent.run("Draft a message");
    agent.destroy();
    expect(result.stopReason).toBe("done");
    expect(result.text).toBe("Drafted by the Writer.");
  });
  it("withholds a prose translation when the required tool never ran", async () => {
    const fixture = createSessionFixture([
      "```tool_code\ndetect_fixture()\n```",
      "English: Hello. Portuguese: Olá.",
      "English: Hello. Portuguese: Olá.",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const agent = createAgentLoop({
      requireToolResult: true,
      tools: [
        {
          name: "detect_fixture",
          description: "Detect a language.",
          inputSchema: { type: "object" },
          execute: async () => ({ language: "ja" }),
        },
        {
          name: "translate_fixture",
          description: "Translate text.",
          inputSchema: { type: "object" },
          requiredCallIf: () => true,
          execute: async () => ({ translation: "Olá" }),
        },
      ],
    });
    const result = await agent.run("Translate it to Portuguese");
    agent.destroy();
    expect(result.stopReason).toBe("tool_error");
    expect(result.text).toContain("translate_fixture did not complete");
    expect(result.text).not.toContain("Olá");
  });

  it("keeps prepared tool sessions until the agent is destroyed", async () => {
    const fixture = createSessionFixture([
      "```tool_code\nprepare_fixture()\n```",
      "Prepared.",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const release = vi.fn();
    const execute = vi.fn(async (_input: unknown, ctx: AgentToolContext) => {
      await ctx.leases?.acquire("fixture", () => ({
        ready: Promise.resolve(),
        release,
      })).ready;
      return { prepared: true };
    });
    const agent = createAgentLoop({
      tools: [
        {
          name: "prepare_fixture",
          description: "Prepare a fixture session.",
          inputSchema: { type: "object" },
          execute,
        },
      ],
    });
    await agent.run("Prepare the fixture");
    expect(execute).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
    agent.destroy();
    expect(release).toHaveBeenCalledTimes(1);
  });
  it("hides Gemma tool-call tokens from thoughts and streamed text", async () => {
    // Replies captured live from Chrome 154 with the Gemma 4 Prompt API model.
    const fixture = createSessionFixture([
      [
        "<|tool",
        "_call>call:detect_language(text='こんにちは')\n",
        "```tool_code\ndetect_language(text='こんにちは')\n```",
      ],
      [
        "<|tool_call>call:translate_text(text='こんにちは', targetLanguage='en')\n",
        "<|tool_call>call:translate_text(text='こんにちは', targetLanguage='pt')<tool_call|>",
      ],
      ["Good afternoon. ", "Boa tarde."],
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const tool = (name: string): AgentTool => ({
      name,
      description: name,
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
          targetLanguage: { type: "string" },
        },
      },
      async execute(input) {
        calls.push(name);
        return input;
      },
    });
    const agent = createAgentLoop({
      tools: [tool("detect_language"), tool("translate_text")],
    });

    const stream = agent.runStreaming(
      "Detect the language of 'こんにちは', then translate it to English and Portuguese.",
    );
    const visible: string[] = [];
    for await (const ev of stream) {
      if (ev.type === "thought") visible.push(ev.text);
      if (ev.type === "text_delta") visible.push(ev.delta);
    }
    agent.destroy();

    expect(calls).toEqual([
      "detect_language",
      "translate_text",
      "translate_text",
    ]);
    expect(visible.join("")).toBe("Good afternoon. Boa tarde.");
    await expect(stream.result).resolves.toMatchObject({
      text: "Good afternoon. Boa tarde.",
    });
  });

  it("dispatches a Gemma tool call and ignores its imagined tool response", async () => {
    // Captured live: after the call, the model invents a tool response.
    const fixture = createSessionFixture([
      '<|tool_call>call:clock_now(timeZone="Asia/Tokyo")\n```json\n{\n  "timeZone": "Asia/Tokyo",\n  "currentTime": "2024-05-24T12:00:00.000Z"\n}\n```\nThe current time in Tokyo is 12:00:00.',
      "It is 12:34 in Tokyo.",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const agent = createAgentLoop({ tools: [createClockFixtureTool(calls)] });

    const result = await agent.run("What time is it in Tokyo right now?");
    agent.destroy();

    expect(calls).toEqual(["clock_now"]);
    expect(fixture.inputs[1]).toContain('"formatted":"12:34"');
    expect(result.text).toBe("It is 12:34 in Tokyo.");
  });

  it("continues a mixed request until a prefixed clock_now call executes", async () => {
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
      "Fetch https://one.test and https://two.test, then default_api.clock_now().",
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

  it("dispatches a direct URL without trailing prose punctuation", async () => {
    const fixture = createSessionFixture(["Fetch-only answer."]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const fetchedUrls: string[] = [];
    const agent = createAgentLoop({
      tools: [
        createFetchFixtureTool(calls, fetchedUrls),
        createClockFixtureTool(calls),
      ],
    });

    await agent.run(
      "Fetch https://github.com/obetomuniz/web-ai-sdk/issues/160, then summarize it.",
    );
    agent.destroy();

    expect(fetchedUrls).toEqual([
      "https://github.com/obetomuniz/web-ai-sdk/issues/160",
    ]);
  });

  it("dispatches canonical URLs for punctuated multi-URL prompts", async () => {
    const fixture = createSessionFixture(["Fetch-only answer."]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const fetchedUrls: string[] = [];
    const agent = createAgentLoop({
      tools: [
        createFetchFixtureTool(calls, fetchedUrls),
        createClockFixtureTool(calls),
      ],
    });

    await agent.run(
      "Compare https://one.test/items/1; with https://two.test/wiki/Function_(mathematics).",
    );
    agent.destroy();

    expect(fetchedUrls).toEqual([
      "https://one.test/items/1",
      "https://two.test/wiki/Function_(mathematics)",
    ]);
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

  it("steers a plain-language live-value request to its required tool", async () => {
    const fixture = createSessionFixture([
      "It is 3:45 PM.",
      "```tool_code\nclock_now()\n```",
      "It is 12:34.",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const agent = createAgentLoop({
      tools: [createFetchFixtureTool(calls), createClockFixtureTool(calls)],
    });

    const result = await agent.run("What time is it right now?");
    agent.destroy();

    expect(calls).toEqual(["clock_now"]);
    expect(result.stopReason).toBe("done");
    expect(result.text).toBe("It is 12:34.");
  });

  it("reports a guessed live value when its tool never runs", async () => {
    const fixture = createSessionFixture(["It is 3:45 PM.", "It is 3:45 PM."]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const agent = createAgentLoop({
      tools: [createFetchFixtureTool(calls), createClockFixtureTool(calls)],
    });

    const result = await agent.run("What time is it right now?");
    agent.destroy();

    expect(calls).toEqual([]);
    expect(result.stopReason).toBe("done");
    expect(result.text).toContain("clock_now was not called");
  });

  it("reports a live value as unavailable when its tool fails", async () => {
    const fixture = createSessionFixture([
      "```tool_code\nclock_now()\n```",
      "The current time is unavailable.",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const agent = createAgentLoop({
      tools: [
        createFetchFixtureTool(calls),
        createClockFixtureTool(calls, new Error("Clock unavailable")),
      ],
    });

    const result = await agent.run("What time is it right now?");
    agent.destroy();

    expect(calls).toEqual(["clock_now"]);
    expect(result.stopReason).toBe("done");
    expect(result.text).toContain("clock_now failed: Clock unavailable");
    expect(result.text).toContain("The current time is unavailable.");
  });

  it("rewrites an answer that contradicts fetched evidence", async () => {
    const fixture = createSessionFixture([
      "The repository has 1,238 stars.",
      "The repository has 19 stars.",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const agent = createAgentLoop({
      tools: [
        createFetchFixtureTool(calls, undefined, "stargazers_count: 19"),
        createClockFixtureTool(calls),
      ],
    });

    const result = await agent.run(
      "How many stars does https://one.test have?",
    );
    agent.destroy();

    expect(calls).toEqual(["fetch_url"]);
    expect(fixture.inputs).toHaveLength(2);
    expect(fixture.inputs[1]).toContain("1,238");
    expect(result.stopReason).toBe("done");
    expect(result.text).toBe("The repository has 19 stars.");
  });

  it("flags values that stay unsupported after the rewrite", async () => {
    const fixture = createSessionFixture([
      "The repository has 1,238 stars.",
      "It still has 1,238 stars.",
    ]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const agent = createAgentLoop({
      tools: [
        createFetchFixtureTool(calls, undefined, "stargazers_count: 19"),
        createClockFixtureTool(calls),
      ],
    });

    const result = await agent.run(
      "How many stars does https://one.test have?",
    );
    agent.destroy();

    expect(result.stopReason).toBe("done");
    expect(result.text).toContain("1,238 is not supported by any tool result");
    expect(result.text).toContain("treat it as unavailable");
    expect(result.text).toContain("It still has 1,238 stars.");
  });

  it("keeps grounded tool-backed answers untouched", async () => {
    const fixture = createSessionFixture(["The repository has 19 stars."]);
    createSessionMock.mockReturnValue(fixture.base);
    const calls: string[] = [];
    const agent = createAgentLoop({
      tools: [
        createFetchFixtureTool(calls, undefined, "stargazers_count: 19"),
        createClockFixtureTool(calls),
      ],
    });

    const result = await agent.run(
      "How many stars does https://one.test have?",
    );
    agent.destroy();

    expect(fixture.inputs).toHaveLength(1);
    expect(result.stopReason).toBe("done");
    expect(result.text).toBe("The repository has 19 stars.");
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

  describe("time follow-ups", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-09-24T18:27:32Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("requires clock_now for a follow-up to a restored time question", async () => {
      const fixture = createSessionFixture([
        "It is 00:27 in Vancouver.",
        '```tool_code\nclock_now(timeZone="America/Vancouver")\n```',
        "It is 11:27 in Vancouver.",
      ]);
      createSessionMock.mockReturnValue(fixture.base);
      const agent = createAgentLoop({
        tools: [clockNowTool],
        sessionMode: "thread",
        initialTurns: [
          {
            userInput: "What time is it in Tokyo?",
            assistantText: "It is 3:27 in Tokyo.",
            stopReason: "done",
            steps: [],
          },
        ],
      });

      const result = await agent.run("and vancouver ?");
      agent.destroy();

      expect(fixture.inputs[1]).toContain("requires `clock_now`");
      expect(result.stopReason).toBe("done");
      expect(result.text).toBe("It is 11:27 in Vancouver.");
    });

    it("carries earlier runs into the follow-up check", async () => {
      const fixture = createSessionFixture([
        '```tool_code\nclock_now(timeZone="Asia/Tokyo")\n```',
        "It is 3:27 in Tokyo.",
        "It is 00:27 in Vancouver.",
        '```tool_code\nclock_now(timeZone="America/Vancouver")\n```',
        "It is 11:27 in Vancouver.",
      ]);
      createSessionMock.mockReturnValue(fixture.base);
      const agent = createAgentLoop({
        tools: [clockNowTool],
        sessionMode: "thread",
      });

      await agent.run("What time is it in Tokyo?");
      const result = await agent.run("and vancouver ?");
      agent.destroy();

      expect(fixture.inputs[3]).toContain("requires `clock_now`");
      expect(result.text).toBe("It is 11:27 in Vancouver.");
    });
  });
});

function createFetchFixtureTool(
  calls: string[],
  fetchedUrls?: string[],
  pageText?: string,
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
      fetchedUrls?.push(url);
      return { status: 200, url, text: pageText ?? `Content from ${url}` };
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
    requiredCallIf(ctx) {
      return /\btime\b/i.test(ctx.userInput);
    },
    async execute() {
      calls.push("clock_now");
      if (failure) throw failure;
      return { formatted: "12:34" };
    },
  };
}

/** A string reply streams as one chunk; an array streams chunk by chunk. */
function createSessionFixture(
  replies: readonly (string | readonly string[])[],
): {
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
        const reply = replies[replyIndex++];
        return typeof reply === "string" ? reply : (reply?.join("") ?? null);
      },
      async *sendStreaming(input) {
        inputs.push(String(input));
        const reply = replies[replyIndex++];
        if (reply === undefined) {
          throw new Error("Fixture ran out of model replies.");
        }
        yield* typeof reply === "string" ? [reply] : reply;
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
