import { describe, expect, it } from "vitest";
import type { AgentRunContext } from "../runContext.js";
import { clockNowTool } from "./clock.js";

function runContext(
  userInput: string,
  previousUserInputs: readonly string[] = [],
): AgentRunContext {
  return {
    userInput,
    previousUserInputs,
    userUrls: new Set(),
    knownUrls: new Set(),
    fetchedSources: [],
  };
}

function isTimeRequest(ctx: AgentRunContext): boolean {
  const required = clockNowTool.requiredCallIf?.(ctx) ?? false;
  // Dispatch and the evidence requirement must never disagree.
  expect(clockNowTool.acceptCall?.({}, ctx)).toBe(required);
  return required;
}

describe("clockNowTool time-request policy", () => {
  it("recognizes a direct current-time question", () => {
    expect(isTimeRequest(runContext("What time is it in Tokyo?"))).toBe(true);
    expect(isTimeRequest(runContext("Explain how time zones work."))).toBe(
      false,
    );
  });

  it("treats a short follow-up to a time question as a time question", () => {
    const tokyo = ["What time is it in Tokyo?"];

    expect(isTimeRequest(runContext("and vancouver ?", tokyo))).toBe(true);
    expect(isTimeRequest(runContext("What about São Paulo?", tokyo))).toBe(
      true,
    );
    expect(isTimeRequest(runContext("e Londres?", tokyo))).toBe(true);
    expect(isTimeRequest(runContext("And in New York City?", tokyo))).toBe(
      true,
    );
  });

  it("follows a chain of follow-ups back to the time question", () => {
    expect(
      isTimeRequest(
        runContext("and London?", [
          "What time is it in Tokyo?",
          "and Vancouver?",
        ]),
      ),
    ).toBe(true);
  });

  it("looks past acknowledgements to the time question", () => {
    expect(
      isTimeRequest(
        runContext("and paris?", [
          "what time is it in tokyo?",
          "and london?",
          "thanks!",
        ]),
      ),
    ).toBe(true);
    expect(
      isTimeRequest(
        runContext("e Paris?", ["What time is it in Tokyo?", "ok, obrigado"]),
      ),
    ).toBe(true);
  });

  it("ignores follow-ups that do not continue a time question", () => {
    expect(isTimeRequest(runContext("and vancouver ?"))).toBe(false);
    expect(
      isTimeRequest(runContext("and vancouver ?", ["Describe Canada."])),
    ).toBe(false);
    // An unrelated message breaks the chain.
    expect(
      isTimeRequest(
        runContext("and London?", [
          "What time is it in Tokyo?",
          "Describe Canada.",
        ]),
      ),
    ).toBe(false);
  });

  it("does not read other short replies after a time question as follow-ups", () => {
    const tokyo = ["What time is it in Tokyo?"];

    expect(isTimeRequest(runContext("thanks!", tokyo))).toBe(false);
    expect(isTimeRequest(runContext("and thanks!", tokyo))).toBe(false);
    expect(
      isTimeRequest(runContext("and summarize https://example.test", tokyo)),
    ).toBe(false);
    expect(
      isTimeRequest(
        runContext("and then write a short story about the ocean", tokyo),
      ),
    ).toBe(false);
  });
});
