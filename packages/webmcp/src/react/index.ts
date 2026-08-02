import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  normalizeToolDefinition,
  type RegistrableTool,
  type StandardSchemaV1,
  type ToolDefinition,
} from "../definition.js";
import {
  type GetToolsOptions,
  getTools,
  isAvailable,
  type RegisteredTool,
  type RegisterToolOptions,
  registerTool,
  subscribeToToolChanges,
} from "../index.js";
import { type Tool, toRegisteredToolMetadata } from "../tool.js";

export interface UseWebMCPOptions extends RegisterToolOptions, GetToolsOptions {
  /** Whether registration and discovery are active. Defaults to `true`. */
  enabled?: boolean;
}

export type WebMCPStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable"
  | "error";

export interface UseWebMCPReturn {
  status: WebMCPStatus;
  /** Every tool exposed to the document, not only definitions passed in. */
  tools: readonly RegisteredTool[];
  error: Error | null;
  /** Re-read the currently exposed tools and return the fresh list. */
  refresh: () => Promise<readonly RegisteredTool[]>;
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

const isToolInput = (
  value: unknown,
): value is RegistrableTool | readonly RegistrableTool[] =>
  Array.isArray(value) ||
  (typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "description" in value &&
    "execute" in value);

/** Register one direct schema-aware tool definition. */
export function useWebMCP<
  InputSchema extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
  OutputSchema extends StandardSchemaV1 | undefined = undefined,
>(
  tool: ToolDefinition<InputSchema, TOutput, OutputSchema>,
  options?: UseWebMCPOptions,
): UseWebMCPReturn;
/** Register one existing plain Tool. */
export function useWebMCP<TInput, TOutput>(
  tool: Tool<TInput, TOutput>,
  options?: UseWebMCPOptions,
): UseWebMCPReturn;
/** Register an existing readonly collection of compatible tools. */
export function useWebMCP<const Tools extends readonly RegistrableTool[]>(
  tools: Tools,
  options?: UseWebMCPOptions,
): UseWebMCPReturn;
/** Retrieve exposed tools without registering definitions. */
export function useWebMCP(options?: UseWebMCPOptions): UseWebMCPReturn;

/**
 * Register WebMCP tools with React lifecycle cleanup and retrieve every tool
 * exposed to the current document. Registration changes only when discoverable
 * metadata, `enabled`, or `exposedTo` values change; schemas and execute
 * callbacks always use the latest committed render. Discovery refreshes after
 * native `toolchange` events and can also be triggered with `refresh()`.
 *
 * Call with options only to retrieve tools without registering definitions.
 * `fromOrigins` participates in the discovery effect dependency list by
 * reference; callers should memoize arrays created during render.
 */
export function useWebMCP(
  toolOrToolsOrOptions?:
    | RegistrableTool
    | readonly RegistrableTool[]
    | UseWebMCPOptions,
  maybeOptions?: UseWebMCPOptions,
): UseWebMCPReturn {
  const hasToolInput = isToolInput(toolOrToolsOrOptions);
  const options = hasToolInput
    ? maybeOptions
    : (toolOrToolsOrOptions as UseWebMCPOptions | undefined);
  const enabled = options?.enabled ?? true;
  const exposedTo = options?.exposedTo;
  const fromOrigins = options?.fromOrigins;
  const definitions: readonly RegistrableTool[] = hasToolInput
    ? Array.isArray(toolOrToolsOrOptions)
      ? toolOrToolsOrOptions
      : [toolOrToolsOrOptions as RegistrableTool]
    : [];
  const latestTools = useRef<readonly Tool[]>(
    definitions.map((tool) => normalizeToolDefinition(tool)),
  );
  const registrationKey = enabled
    ? getRegistrationKey(definitions, exposedTo)
    : "disabled";
  const activeRegistration = useRef<ActiveRegistration | undefined>(undefined);
  const requestId = useRef(0);
  const [state, setState] = useState<{
    status: WebMCPStatus;
    tools: readonly RegisteredTool[];
    error: Error | null;
  }>(() => ({
    status: !enabled ? "idle" : isAvailable() ? "loading" : "unavailable",
    tools: [],
    error: null,
  }));

  useCommitEffect(() => {
    latestTools.current = definitions.map((tool) =>
      normalizeToolDefinition(tool),
    );
  });

  useEffect(() => {
    if (!enabled || definitions.length === 0) {
      activeRegistration.current?.cleanup();
      activeRegistration.current = undefined;
      return;
    }

    if (activeRegistration.current?.key === registrationKey) return;

    activeRegistration.current?.cleanup();

    const registerOptions: RegisterToolOptions | undefined =
      exposedTo === undefined ? undefined : { exposedTo };
    const cleanups = wrapTools(definitions, latestTools).map((tool) =>
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

  const refresh = useCallback(async (): Promise<readonly RegisteredTool[]> => {
    const currentRequest = ++requestId.current;
    if (!enabled) {
      setState({ status: "idle", tools: [], error: null });
      return [];
    }
    if (!isAvailable()) {
      setState({ status: "unavailable", tools: [], error: null });
      return [];
    }

    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const tools = await getTools(
        fromOrigins === undefined ? undefined : { fromOrigins },
      );
      if (requestId.current === currentRequest) {
        setState({ status: "ready", tools, error: null });
      }
      return tools;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (requestId.current === currentRequest) {
        setState({ status: "error", tools: [], error });
      }
      return [];
    }
  }, [enabled, fromOrigins]);

  useEffect(() => {
    void refresh();
    if (!enabled || !isAvailable()) {
      return () => {
        requestId.current += 1;
      };
    }

    const unsubscribe = subscribeToToolChanges(() => {
      void refresh();
    });
    return () => {
      requestId.current += 1;
      unsubscribe();
    };
  }, [enabled, refresh]);

  return { ...state, refresh };
}

export type {
  DefineToolOptions,
  ExecuteToolOptions,
  GetToolsOptions,
  RegisteredTool,
  RegisterToolOptions,
  StandardSchemaV1,
  Tool,
  ToolAnnotations,
  ToolDefinition,
} from "../index.js";
export {
  defineTool,
  executeTool,
  getTools,
  subscribeToToolChanges,
  ToolOutputValidationError,
  ToolValidationError,
  WebMCPUnavailableError,
} from "../index.js";
