// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { AgentEvent } from "../experimental/agent/types.js";
import { MODES } from "../experimental/playground/presets.js";
import {
  type CapabilityCheck,
  useCapabilityReadiness,
} from "./useCapabilityReadiness.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.unstubAllGlobals();
});
it("derives selected checks, keeps unknown pairs lazy, and uses task readiness", async () => {
  const create = vi.fn();
  const translationAvailability = vi.fn();
  vi.stubGlobal("Translator", {
    create,
    availability: translationAvailability,
  });
  vi.stubGlobal("Summarizer", {
    create,
    availability: async () => "downloadable",
  });
  vi.stubGlobal("LanguageDetector", {
    create,
    availability: async () => "available",
  });
  let checks: CapabilityCheck[] = [];
  function Harness({
    modeId,
    events = [],
  }: {
    modeId: string;
    events?: AgentEvent[];
  }) {
    checks = useCapabilityReadiness(
      MODES.find((mode) => mode.id === modeId) ?? MODES[0],
      events,
    );
    return null;
  }
  root = createRoot(document.createElement("div"));
  await act(async () => root?.render(<Harness modeId="minimal" />));
  expect(checks.map((check) => check.label)).toEqual(["Summarizer · titles"]);
  await act(async () => root?.render(<Harness modeId="web-ai-suite" />));
  expect(checks.find((check) => check.label === "Translator")?.state).toBe(
    "unknown",
  );
  expect(translationAvailability).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  await act(async () =>
    root?.render(
      <Harness
        modeId="web-ai-suite"
        events={[
          {
            type: "tool_call",
            index: 0,
            callId: "call-pair",
            name: "translate_text",
            input: { text: "Hi", sourceLanguage: "en", targetLanguage: "pt" },
          },
          {
            type: "tool_progress",
            callId: "call-pair",
            name: "translate_text",
            data: { phase: "readiness", state: "downloading" },
          },
        ]}
      />,
    ),
  );
  expect(
    checks.find((check) => check.label.includes("call-pair")),
  ).toMatchObject({
    state: "downloading",
    detail: expect.stringContaining('"targetLanguage":"pt"'),
  });
});
