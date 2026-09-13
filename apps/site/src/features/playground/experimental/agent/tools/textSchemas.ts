import { z } from "zod";
import type { AgentTool } from "../types.js";

export const textInput = z
  .string()
  .refine((text) => text.trim().length > 0, "Supply non-empty text.");
export const languageInput = z.string().trim().min(1);
export function toolSchema(schema: z.ZodObject): AgentTool["inputSchema"] {
  return z.toJSONSchema(schema, {
    io: "input",
    target: "draft-2020-12",
  }) as AgentTool["inputSchema"];
}
