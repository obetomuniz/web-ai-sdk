import { expect, it } from "vitest";
import { promptCheck } from "./RuntimePanel.js";

it("shows Prompt API download progress in the check", () => {
  expect(promptCheck("downloading", 0.57)).toEqual({
    label: "Prompt API",
    detail: "Model download: 57%",
    state: "downloading",
  });
  expect(promptCheck("downloadable", null)).toMatchObject({
    detail: "Conversation responses",
    state: "download",
  });
  expect(promptCheck("available", 1)).toMatchObject({
    detail: "Conversation responses",
    state: "ready",
  });
});
