import { useEffect, useLayoutEffect, useRef } from "react";
import { type RegisterToolOptions, registerTool, type Tool } from "../index.js";

export interface UseWebMCPOptions extends RegisterToolOptions {
  /** Whether the tools should currently be registered. Defaults to `true`. */
  enabled?: boolean;
}

interface ActiveRegistration {
  key: string;
  cleanup: () => void;
}

const getRegistrationKey = (
  tools: readonly Tool[],
  exposedTo: readonly string[] | undefined,
): string => {
  const metadata = {
    tools: tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      readOnly: tool.readOnly,
      destructive: tool.destructive,
      annotations: tool.annotations,
    })),
    exposedTo,
  };
  const seen = new WeakSet<object>();
  try {
    return (
      JSON.stringify(metadata, (_key, value: unknown) => {
        if (typeof value === "bigint") return `bigint:${value.toString()}`;
        if (typeof value !== "object" || value === null) return value;
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
        return value;
      }) ?? ""
    );
  } catch {
    return JSON.stringify({
      tools: metadata.tools.map(
        ({ name, title, description, readOnly, destructive }) => ({
          name,
          title,
          description,
          readOnly,
          destructive,
        }),
      ),
      exposedTo,
    });
  }
};

const useCommitEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const wrapTools = (
  tools: readonly Tool[],
  latestExecutors: {
    readonly current: ReadonlyMap<string, Tool["execute"]>;
  },
): readonly Tool[] =>
  tools.map((tool) => {
    const initialExecute = tool.execute;
    return {
      ...tool,
      execute: (input: unknown) =>
        (latestExecutors.current.get(tool.name) ?? initialExecute)(input),
    };
  });

/**
 * React hook that registers one or more WebMCP tools on mount and unregisters
 * them on unmount. Registration changes only when discoverable metadata,
 * `enabled`, or `exposedTo` values change; execute callbacks always use the
 * latest committed render.
 *
 * On browsers that don't expose `document.modelContext` (or the legacy
 * `navigator.modelContext`), the hook is a no-op.
 */
export const useWebMCP = (
  toolOrTools: Tool | readonly Tool[],
  options?: UseWebMCPOptions,
): void => {
  const enabled = options?.enabled ?? true;
  const exposedTo = options?.exposedTo;
  const tools: readonly Tool[] = Array.isArray(toolOrTools)
    ? toolOrTools
    : [toolOrTools];
  const latestExecutors = useRef<ReadonlyMap<string, Tool["execute"]>>(
    new Map(tools.map((tool) => [tool.name, tool.execute])),
  );
  const activeRegistration = useRef<ActiveRegistration | undefined>(undefined);

  useCommitEffect(() => {
    latestExecutors.current = new Map(
      tools.map((tool) => [tool.name, tool.execute]),
    );
  });

  useEffect(() => {
    if (!enabled) {
      activeRegistration.current?.cleanup();
      activeRegistration.current = undefined;
      return;
    }

    const registrationKey = getRegistrationKey(tools, exposedTo);
    if (activeRegistration.current?.key === registrationKey) return;

    activeRegistration.current?.cleanup();

    const registerOptions: RegisterToolOptions | undefined =
      exposedTo === undefined ? undefined : { exposedTo };
    const cleanups = wrapTools(tools, latestExecutors).map((tool) =>
      registerTool(tool, registerOptions),
    );
    activeRegistration.current = {
      key: registrationKey,
      cleanup: () => {
        for (const cleanup of cleanups) cleanup();
      },
    };
  });

  useEffect(
    () => () => {
      activeRegistration.current?.cleanup();
      activeRegistration.current = undefined;
    },
    [],
  );
};

export type {
  DefineToolOptions,
  RegisterToolOptions,
  StandardSchemaV1,
  Tool,
  ToolAnnotations,
} from "../index.js";
export {
  defineTool,
  ToolOutputValidationError,
  ToolValidationError,
} from "../index.js";
