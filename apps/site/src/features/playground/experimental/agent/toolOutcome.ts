import type { AgentToolCallRecord } from "./types.js";

export type ToolOutcome =
  | "success"
  | "unavailable"
  | "invalid input"
  | "error"
  | "cancelled";

/** Also understands persisted results from the older adapters. */
export function toolOutcome(
  record: Pick<AgentToolCallRecord, "error" | "output">,
): ToolOutcome {
  const name = record.error?.name ?? "";
  if (name === "AbortError") return "cancelled";
  if (name.endsWith("UnavailableError")) return "unavailable";
  if (name === "AgentToolValidationError" || name === "ZodError")
    return "invalid input";
  if (record.error) return "error";
  if (record.output && typeof record.output === "object") {
    const output = record.output as { unavailable?: unknown; error?: unknown };
    if (output.unavailable === true) return "unavailable";
    if (output.error) return "error";
  }
  return "success";
}
