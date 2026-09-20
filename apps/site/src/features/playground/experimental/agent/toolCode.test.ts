import { expect, it } from "vitest";
import { parseToolCode } from "./toolCode.js";
import type { AgentTool } from "./types.js";

function tool(name: string, properties: string[]): AgentTool {
  return {
    name,
    description: name,
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(properties.map((key) => [key, {}])),
    },
    execute: async () => ({}),
  };
}

it("parses list arguments instead of leaving them as strings", () => {
  const proofread = tool("proofread_text", ["text", "expectedInputLanguages"]);
  expect(
    parseToolCode(
      '```tool_code\nproofread_text(text="I seen him.", expectedInputLanguages=["en"])\n```',
      [proofread],
    ),
  ).toEqual([
    {
      name: "proofread_text",
      input: { text: "I seen him.", expectedInputLanguages: ["en"] },
    },
  ]);
});

it("parses python-style list arguments", () => {
  const proofread = tool("proofread_text", ["text", "expectedInputLanguages"]);
  expect(
    parseToolCode(
      "```tool_code\nproofread_text(text='I seen him.', expectedInputLanguages=['en', 'es'])\n```",
      [proofread],
    ),
  ).toEqual([
    {
      name: "proofread_text",
      input: {
        text: "I seen him.",
        expectedInputLanguages: ["en", "es"],
      },
    },
  ]);
});

it("keeps a language string as a string for schema coercion", () => {
  const proofread = tool("proofread_text", ["text", "expectedInputLanguages"]);
  expect(
    parseToolCode(
      '```tool_code\nproofread_text(text="I seen him.", expectedInputLanguages="en")\n```',
      [proofread],
    ),
  ).toEqual([
    {
      name: "proofread_text",
      input: { text: "I seen him.", expectedInputLanguages: "en" },
    },
  ]);
});

it("parses Writer format aliases as strings", () => {
  const write = tool("write_text", ["task", "format"]);
  expect(
    parseToolCode(
      '```tool_code\nwrite_text(task="Draft a welcome email", format="plain_text")\n```',
      [write],
    ),
  ).toEqual([
    {
      name: "write_text",
      input: { task: "Draft a welcome email", format: "plain_text" },
    },
  ]);
});
