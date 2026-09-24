import { afterEach, expect, it, vi } from "vitest";
import { MODES } from "../experimental/playground/presets.js";
import { selectedCapabilityChecks } from "./useCapabilityChecks.js";

afterEach(() => vi.unstubAllGlobals());
it("selects mode capabilities without creating models or guessing translation options", () => {
  const create = vi.fn();
  const availability = vi.fn();
  vi.stubGlobal("Translator", { create, availability });
  expect(selectedCapabilityChecks(MODES[0].tools)).toEqual([]);
  const suite = MODES.find((mode) => mode.id === "web-ai-suite");
  const checks = selectedCapabilityChecks(suite?.tools ?? []);
  expect(checks).toHaveLength(6);
  expect(
    checks.find((check) => check.label === "Translator API"),
  ).toMatchObject({
    state: "unknown",
    detail: expect.stringContaining("language pair"),
  });
  expect(create).not.toHaveBeenCalled();
  expect(availability).not.toHaveBeenCalled();
});
