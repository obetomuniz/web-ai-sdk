import { useEffect } from "react";
import { type Tool, registerTool } from "../index.js";

/**
 * React hook that registers WebMCP tools on mount and unregisters them on
 * unmount. Pass a stable `tools` reference (e.g. via `useMemo`); the effect
 * re-runs whenever the array reference changes.
 *
 * On browsers that don't expose `navigator.modelContext`, the hook is a no-op.
 */
export const useWebMCP = (tools: readonly Tool[]): void => {
  useEffect(() => {
    const cleanups = tools.map(registerTool);
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [tools]);
};

export { defineTool, ToolValidationError } from "../index.js";
export type {
  Tool,
  ToolAnnotations,
  DefineToolOptions,
  StandardSchemaV1,
} from "../index.js";
