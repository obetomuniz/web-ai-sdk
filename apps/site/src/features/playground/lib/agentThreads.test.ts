import { describe, expect, it } from "vitest";
import { normalizeAgentThreadState, sortAgentThreads } from "./agentThreads.js";

const validTurn = {
  id: "turn-1",
  createdAt: 20,
  userInput: "Hello",
  assistantText: "Hi",
  steps: [],
  stopReason: "done" as const,
};

const validConversation = {
  id: "conversation-1",
  name: "Greeting",
  modeId: "minimal",
  turns: [validTurn],
  createdAt: 10,
  updatedAt: 20,
};

describe("normalizeAgentThreadState", () => {
  it("keeps valid conversations when another stored entry is corrupt", () => {
    const state = normalizeAgentThreadState({
      activeId: "missing",
      threads: [null, validConversation],
    });

    expect(state).toEqual({
      activeId: validConversation.id,
      threads: [validConversation],
    });
  });

  it("drops malformed turns without discarding the conversation", () => {
    const state = normalizeAgentThreadState({
      activeId: validConversation.id,
      threads: [
        {
          ...validConversation,
          turns: [validTurn, { userInput: "incomplete" }],
        },
      ],
    });

    expect(state?.threads[0]?.turns).toEqual([validTurn]);
  });

  it("returns undefined when no usable conversation remains", () => {
    expect(
      normalizeAgentThreadState({ activeId: "missing", threads: [null] }),
    ).toBeUndefined();
  });
});

describe("sortAgentThreads", () => {
  it("orders conversations by most recent activity", () => {
    const older = { ...validConversation, id: "older", updatedAt: 25 };
    const newer = { ...validConversation, id: "newer", updatedAt: 50 };

    expect(sortAgentThreads([older, newer]).map(({ id }) => id)).toEqual([
      "newer",
      "older",
    ]);
  });
});
