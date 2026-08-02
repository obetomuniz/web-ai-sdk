import { useEffect, useLayoutEffect, useRef } from "react";
import { type RegisterToolOptions, registerTool } from "../index.js";
import { type Tool, toRegisteredToolMetadata } from "../tool.js";

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
  try {
    return stableStringify({
      tools: tools.map(toRegisteredToolMetadata),
      exposedTo,
    });
  } catch {
    return JSON.stringify({
      tools: tools.map(({ name, title, description }) => ({
        name,
        title,
        description,
      })),
      exposedTo,
    });
  }
};

const stableStringify = (value: unknown): string => {
  const ancestors = new WeakSet<object>();

  const normalize = (current: unknown): unknown => {
    if (typeof current === "bigint") return `bigint:${current.toString()}`;
    if (typeof current !== "object" || current === null) return current;
    if (ancestors.has(current)) return "[Circular]";

    ancestors.add(current);
    try {
      const toJSON = Reflect.get(current, "toJSON");
      if (typeof toJSON === "function") {
        const jsonValue: unknown = Reflect.apply(toJSON, current, []);
        if (jsonValue !== current) return normalize(jsonValue);
      }

      if (Array.isArray(current)) return current.map(normalize);

      const normalized = Object.create(null) as Record<string, unknown>;
      for (const key of Object.keys(current).sort()) {
        normalized[key] = normalize(Reflect.get(current, key));
      }
      return normalized;
    } finally {
      ancestors.delete(current);
    }
  };

  return JSON.stringify(normalize(value)) ?? "";
};

const useCommitEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const wrapTools = (
  tools: readonly Tool[],
  latestExecutors: {
    readonly current: readonly Tool["execute"][];
  },
): readonly Tool[] =>
  tools.map((tool, index) => {
    const initialExecute = tool.execute;
    return {
      ...tool,
      execute: (input: unknown) =>
        (latestExecutors.current[index] ?? initialExecute)(input),
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
  const latestExecutors = useRef<readonly Tool["execute"][]>(
    tools.map((tool) => tool.execute),
  );
  const activeRegistration = useRef<ActiveRegistration | undefined>(undefined);

  useCommitEffect(() => {
    latestExecutors.current = tools.map((tool) => tool.execute);
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
