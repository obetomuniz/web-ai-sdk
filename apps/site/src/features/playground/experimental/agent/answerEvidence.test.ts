import { describe, expect, it } from "vitest";
import { findUnsupportedAnswerValues } from "./answerEvidence.js";
import type { AgentToolCallRecord } from "./types.js";

function record(
  overrides: Partial<AgentToolCallRecord> = {},
): AgentToolCallRecord {
  return {
    callId: "call-1",
    name: "fetch_url",
    input: { url: "https://one.test" },
    output: { status: 200, url: "https://one.test", text: "stars: 19" },
    durationMs: 5,
    ...overrides,
  };
}

describe("findUnsupportedAnswerValues", () => {
  it("returns fabricated values in their display form", () => {
    const unsupported = findUnsupportedAnswerValues(
      "The repository has 1,238 stars.",
      "How many stars does https://one.test have?",
      [record()],
    );

    expect(unsupported).toEqual(["1,238"]);
  });

  it("supports values present in tool output, including embedded runs", () => {
    const clock = record({
      name: "clock_now",
      input: {},
      output: { formatted: "Wednesday, August 6, 2026 at 12:34:56", iso: "" },
    });

    expect(
      findUnsupportedAnswerValues("It is 12:34.", "What time is it?", [clock]),
    ).toEqual([]);
  });

  it("treats the user's own numbers as supported", () => {
    const unsupported = findUnsupportedAnswerValues(
      "All 42 items are covered.",
      "Check the 42 items on https://one.test",
      [record()],
    );

    expect(unsupported).toEqual([]);
  });

  it("ignores single-digit counts the model can derive itself", () => {
    const unsupported = findUnsupportedAnswerValues(
      "I compared 2 pages and found 3 differences.",
      "Compare https://one.test and https://two.test",
      [record()],
    );

    expect(unsupported).toEqual([]);
  });

  it("dedupes repeated unsupported values", () => {
    const unsupported = findUnsupportedAnswerValues(
      "It has 1,238 stars. Yes, 1238 stars.",
      "How many stars?",
      [record()],
    );

    expect(unsupported).toEqual(["1,238"]);
  });

  it("flags a negative value when the evidence only has the positive form", () => {
    const positiveOnly = record({
      output: { status: 200, url: "https://one.test", text: "delta: 25" },
    });

    expect(
      findUnsupportedAnswerValues(
        "The delta is -25.",
        "What is the delta on https://one.test?",
        [positiveOnly],
      ),
    ).toEqual(["-25"]);
  });

  it("supports a negative value present in the tool output", () => {
    const negative = record({
      output: { status: 200, url: "https://one.test", delta: -25 },
    });

    expect(
      findUnsupportedAnswerValues(
        "The delta is -25.",
        "What is the delta on https://one.test?",
        [negative],
      ),
    ).toEqual([]);
  });

  it("does not read ranges or dates as negative values", () => {
    const dated = record({
      output: {
        status: 200,
        url: "https://one.test",
        text: "Pages 10-15, updated 2026-08-06",
      },
    });

    expect(
      findUnsupportedAnswerValues(
        "Covers pages 10-15, last updated 2026-08-06.",
        "Check https://one.test",
        [dated],
      ),
    ).toEqual([]);
  });

  it("counts numbers in failed-call error messages as evidence", () => {
    const failed = record({
      output: undefined,
      error: { message: "Request timed out after 3000 ms" },
    });

    expect(
      findUnsupportedAnswerValues(
        "The request timed out after 3000 ms.",
        "Fetch https://one.test",
        [failed],
      ),
    ).toEqual([]);
  });
});
