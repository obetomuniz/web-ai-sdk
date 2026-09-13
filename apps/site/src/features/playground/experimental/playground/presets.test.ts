import { expect, it } from "vitest";
import { MODES } from "./presets.js";

it.each([
  [
    'Rewrite more formally: "I write books and translate poems."',
    ["rewrite_text"],
  ],
  ["Explain grammar rules", []],
  ["Rewrite: I write books and translate poems.", ["rewrite_text"]],
  ["Rewrite I write books and translate poems", ["rewrite_text"]],
  ["Rewrite: 'I read and write books.'", ["rewrite_text"]],
  ["Revise my summary", ["rewrite_text"]],
  ['Check grammar: "I seen him."', ["proofread_text"]],
  ["Could you please draft a welcome email?", ["write_text"]],
  [
    "Detect the language of 'こんにちは', then translate it to English.",
    ["translate_text", "detect_language"],
  ],
])("requires only operations requested by %s", (userInput, expected) => {
  const suite = MODES.find((mode) => mode.id === "web-ai-suite");
  const requested = suite?.tools
    .filter((tool) =>
      tool.requiredCallIf?.({
        userInput,
        userUrls: new Set(),
        knownUrls: new Set(),
        fetchedSources: [],
      }),
    )
    .map((tool) => tool.name);
  expect(requested).toEqual(expected);
});
