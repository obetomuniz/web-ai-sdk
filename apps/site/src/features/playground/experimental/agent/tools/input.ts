import type { z } from "zod";
import { AgentToolValidationError } from "../errors.js";

export function parseToolInput<T>(
  name: string,
  schema: z.ZodType<T>,
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AgentToolValidationError(
      name,
      result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    );
  }
  return result.data;
}

/**
 * Maps near-miss option values from on-device planners (for example
 * `formal` for the Rewriter's `more-formal`) before validation.
 */
export function withAliases(
  input: unknown,
  aliases: Record<string, Record<string, string>>,
): unknown {
  if (!input || typeof input !== "object") return input;
  const next = { ...(input as Record<string, unknown>) };
  for (const [key, values] of Object.entries(aliases)) {
    const value = next[key];
    if (typeof value !== "string") continue;
    const normalized = value.trim().toLowerCase();
    next[key] = values[normalized] ?? normalized;
  }
  return next;
}
