import { useEffect, useLayoutEffect, useRef } from "react";
import {
  normalizeToolDefinition,
  type RegistrableTool,
  type StandardSchemaV1,
  type ToolDefinition,
} from "../definition.js";
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
  tools: readonly RegistrableTool[],
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
  tools: readonly RegistrableTool[],
  latestTools: {
    readonly current: readonly Tool[];
  },
): readonly Tool[] =>
  tools.map((definition, index) => {
    const initialTool = latestTools.current[index];
    const tool: Tool = {
      name: definition.name,
      description: definition.description,
      execute: (input: unknown) =>
        (latestTools.current[index] ?? initialTool)?.execute(input),
    };
    if (definition.title !== undefined) tool.title = definition.title;
    if (definition.inputSchema !== undefined) {
      tool.inputSchema = definition.inputSchema;
    }
    if (definition.readOnly) tool.readOnly = true;
    if (definition.destructive) tool.destructive = true;
    if (definition.annotations) tool.annotations = definition.annotations;
    return tool;
  });

/** Register one direct schema-aware tool definition. */
export function useWebMCP<
  InputSchema extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
  OutputSchema extends StandardSchemaV1 | undefined = undefined,
>(
  tool: ToolDefinition<InputSchema, TOutput, OutputSchema>,
  options?: UseWebMCPOptions,
): void;
/** Register one existing plain Tool. */
export function useWebMCP<TInput, TOutput>(
  tool: Tool<TInput, TOutput>,
  options?: UseWebMCPOptions,
): void;
/** Register an existing readonly collection of compatible tools. */
export function useWebMCP<const Tools extends readonly RegistrableTool[]>(
  tools: Tools,
  options?: UseWebMCPOptions,
): void;

/**
 * React hook that registers one or more WebMCP tools on mount and unregisters
 * them on unmount. Registration changes only when discoverable metadata,
 * `enabled`, or `exposedTo` values change; schemas and execute callbacks always
 * use the latest committed render.
 *
 * On browsers that don't expose `document.modelContext` (or the legacy
 * `navigator.modelContext`), the hook is a no-op.
 */
export function useWebMCP(
  toolOrTools: RegistrableTool | readonly RegistrableTool[],
  options?: UseWebMCPOptions,
): void {
  const enabled = options?.enabled ?? true;
  const exposedTo = options?.exposedTo;
  const tools: readonly RegistrableTool[] = Array.isArray(toolOrTools)
    ? toolOrTools
    : [toolOrTools as RegistrableTool];
  const latestTools = useRef<readonly Tool[]>(
    tools.map((tool) => normalizeToolDefinition(tool)),
  );
  const activeRegistration = useRef<ActiveRegistration | undefined>(undefined);

  useCommitEffect(() => {
    latestTools.current = tools.map((tool) => normalizeToolDefinition(tool));
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
    const cleanups = wrapTools(tools, latestTools).map((tool) =>
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
}

export type {
  DefineToolOptions,
  RegisterToolOptions,
  StandardSchemaV1,
  Tool,
  ToolAnnotations,
  ToolDefinition,
} from "../index.js";
export {
  defineTool,
  ToolOutputValidationError,
  ToolValidationError,
} from "../index.js";
