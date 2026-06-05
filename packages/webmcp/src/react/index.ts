import { useEffect } from "react";
import { registerTool, type Tool } from "../index.js";

/**
 * React hook that registers WebMCP tools on mount and unregisters them on
 * unmount. Pass a stable `tools` reference (e.g. via `useMemo`); the effect
 * re-runs whenever the array reference changes.
 *
 * On browsers that don't expose `document.modelContext` (or the legacy
 * `navigator.modelContext`), the hook is a no-op.
 */
export const useWebMCP = (tools: readonly Tool[]): void => {
  useEffect(() => {
    const cleanups = tools.map(registerTool);
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [tools]);
};

export type {
  DefineToolOptions,
  StandardSchemaV1,
  Tool,
  ToolAnnotations,
} from "../index.js";
export { defineTool, ToolValidationError } from "../index.js";
