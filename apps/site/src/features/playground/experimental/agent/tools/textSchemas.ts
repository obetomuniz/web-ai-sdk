import { z } from "zod";
import type { AgentTool } from "../types.js";

export const textInput = z
  .string()
  .refine((text) => text.trim().length > 0, "Supply non-empty text.");
export const languageInput = z.string().trim().min(1);

export function asToolArgs(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

export function toolSchema(schema: z.ZodObject): AgentTool["inputSchema"] {
  return z.toJSONSchema(schema, {
    io: "input",
    target: "draft-2020-12",
  }) as AgentTool["inputSchema"];
}

/** Native `tool_code` often adds unknown keys and alias spellings. */
export function parseToolInput<S extends z.ZodRawShape>(
  schema: z.ZodObject<S>,
  input: unknown,
): z.infer<z.ZodObject<S>> {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const allowed = new Set(Object.keys(schema.shape));
  const stripped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (allowed.has(key)) stripped[key] = value;
  }
  const result = schema.safeParse(stripped);
  if (result.success) return result.data;
  const error = new Error(
    result.error.issues
      .map((issue) =>
        issue.path.length > 0
          ? `${issue.path.join(".")}: ${issue.message}`
          : issue.message,
      )
      .join("; "),
  );
  error.name = "ZodError";
  throw error;
}

export function coerceOption<T extends string>(
  value: unknown,
  values: readonly T[],
  aliases: Record<string, T>,
  fallback: T,
): T | unknown {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  const token = value.trim().toLowerCase().replace(/[_ ]+/g, "-");
  if ((values as readonly string[]).includes(token)) return token as T;
  // Preserve unknown values so the schema reports an invalid option.
  return aliases[token] ?? value;
}

export function coerceLanguageList(value: unknown): unknown {
  if (value == null || value === "") return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed.replace(/'/g, '"'));
      return Array.isArray(parsed) ? parsed : value;
    } catch {
      return value;
    }
  }
  return trimmed.split(",").map((entry) => entry.trim());
}

export function coerceInteger(value: unknown): unknown {
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return value;
}
