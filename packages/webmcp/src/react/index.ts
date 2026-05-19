import { useEffect } from "react";
import { type Tool, registerTools } from "../index.js";

/**
 * React hook that registers WebMCP tools on mount and unregisters them on
 * unmount. Pass a stable `tools` reference (e.g. via `useMemo`); the effect
 * re-runs whenever the array reference changes.
 *
 * On browsers that don't expose `navigator.modelContext`, the hook is a no-op.
 */
export const useWebMCP = (tools: readonly Tool[]): void => {
  useEffect(() => {
    return registerTools(tools);
  }, [tools]);
};

export type { Tool, ToolAnnotations } from "../index.js";
