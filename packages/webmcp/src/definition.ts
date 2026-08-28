import type {
  Tool,
  ToolAnnotations,
  ToolExecuteCallbackOptions,
  ToolMetadata,
} from "./tool.js";

/**
 * Minimal Standard Schema V1 surface — see https://standardschema.dev. Any
 * validation library that implements the spec satisfies this interface
 * without an adapter or runtime dependency.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) =>
      | StandardSchemaV1.Result<Output>
      | Promise<StandardSchemaV1.Result<Output>>;
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
  };
}

export namespace StandardSchemaV1 {
  export type Result<Output> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: ReadonlyArray<Issue> };

  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment>;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }

  export type InferInput<S> =
    S extends StandardSchemaV1<infer Input, unknown> ? Input : unknown;

  export type InferOutput<S> =
    S extends StandardSchemaV1<unknown, infer Output> ? Output : unknown;
}

export class ToolValidationError extends Error {
  override readonly name = "ToolValidationError";
  readonly toolName: string;
  readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;

  constructor(toolName: string, issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    const summary = issues
      .slice(0, 3)
      .map((issue) => issue.message)
      .join("; ");
    super(`Tool "${toolName}" input validation failed: ${summary}`);
    this.toolName = toolName;
    this.issues = issues;
  }
}

export class ToolOutputValidationError extends Error {
  override readonly name = "ToolOutputValidationError";
  readonly toolName: string;
  readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;

  constructor(toolName: string, issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    const summary = issues
      .slice(0, 3)
      .map((issue) => issue.message)
      .join("; ");
    super(`Tool "${toolName}" output validation failed: ${summary}`);
    this.toolName = toolName;
    this.issues = issues;
  }
}

/** A WebMCP tool definition with optional dependency-free Standard Schemas. */
export interface ToolDefinition<
  InputSchema extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
  OutputSchema extends StandardSchemaV1 | undefined = undefined,
> extends ToolMetadata {
  /**
   * Standard Schema for application-facing input validation. The browser's
   * JSON Schema remains explicit in `inputSchema`.
   */
  input?: InputSchema;
  /** Standard Schema for validating and transforming the resolved result. */
  output?: OutputSchema;
  execute: (
    input: InputSchema extends StandardSchemaV1
      ? StandardSchemaV1.InferOutput<InputSchema>
      : unknown,
    options?: ToolExecuteCallbackOptions,
  ) =>
    | Promise<
        OutputSchema extends StandardSchemaV1
          ? StandardSchemaV1.InferInput<OutputSchema>
          : TOutput
      >
    | (OutputSchema extends StandardSchemaV1
        ? StandardSchemaV1.InferInput<OutputSchema>
        : TOutput);
}

/**
 * Compatibility options for the deprecated `defineTool()` builder.
 *
 * Unlike direct definitions, input validation remains opt-in here so existing
 * callers keep their historical runtime behavior.
 */
export interface DefineToolOptions<
  InputSchema extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
  OutputSchema extends StandardSchemaV1 | undefined = undefined,
> extends ToolMetadata {
  input?: InputSchema;
  output?: OutputSchema;
  validate?: boolean;
  execute: (
    input: InputSchema extends StandardSchemaV1
      ? StandardSchemaV1.InferInput<InputSchema>
      : unknown,
    options?: ToolExecuteCallbackOptions,
  ) =>
    | Promise<
        OutputSchema extends StandardSchemaV1
          ? StandardSchemaV1.InferInput<OutputSchema>
          : TOutput
      >
    | (OutputSchema extends StandardSchemaV1
        ? StandardSchemaV1.InferInput<OutputSchema>
        : TOutput);
}

/** Type-erased carrier used by registration and React internals. */
export interface RegistrableTool extends ToolMetadata {
  input?: StandardSchemaV1;
  output?: StandardSchemaV1;
  execute: (input: never, options?: ToolExecuteCallbackOptions) => unknown;
}

const validateWithSchema = async <Output>(
  schema: StandardSchemaV1<unknown, Output>,
  value: unknown,
  onFailure: (
    issues: ReadonlyArray<StandardSchemaV1.Issue>,
  ) => ToolValidationError | ToolOutputValidationError,
): Promise<Output> => {
  const result = await schema["~standard"].validate(value);
  if ("issues" in result && result.issues) {
    throw onFailure(result.issues);
  }
  return (result as { value: Output }).value;
};

const copyMetadata = (
  definition: ToolMetadata,
  execute: Tool["execute"],
): Tool => {
  const tool: Tool = {
    name: definition.name,
    description: definition.description,
    execute,
  };
  if (definition.title !== undefined) tool.title = definition.title;
  if (definition.inputSchema !== undefined) {
    tool.inputSchema = definition.inputSchema;
  }
  if (definition.readOnly) tool.readOnly = true;
  if (definition.destructive) tool.destructive = true;
  if (definition.annotations) tool.annotations = definition.annotations;
  return tool;
};

/** Normalize SDK-only schemas into a plain native-facing `Tool`. */
export const normalizeToolDefinition = (
  definition: RegistrableTool,
  { validateInput = true }: { validateInput?: boolean } = {},
): Tool => {
  const baseExecute = definition.execute as (
    input: unknown,
    options?: ToolExecuteCallbackOptions,
  ) => Promise<unknown> | unknown;
  const inputSchema = validateInput ? definition.input : undefined;
  const outputSchema = definition.output;

  if (!inputSchema && !outputSchema) {
    return copyMetadata(definition, baseExecute);
  }

  return copyMetadata(definition, async (input, options) => {
    const executeInput = inputSchema
      ? await validateWithSchema(
          inputSchema,
          input,
          (issues) => new ToolValidationError(definition.name, issues),
        )
      : input;
    const result = await baseExecute(executeInput, options);
    if (!outputSchema) return result;
    return validateWithSchema(
      outputSchema,
      result,
      (issues) => new ToolOutputValidationError(definition.name, issues),
    );
  });
};

/**
 * @deprecated Pass the definition directly to `registerTool()` or
 * `useWebMCP()`. This compatibility wrapper will be removed in a documented
 * breaking release.
 */
export const defineTool = <
  InputSchema extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
  OutputSchema extends StandardSchemaV1 | undefined = undefined,
>(
  options: DefineToolOptions<InputSchema, TOutput, OutputSchema>,
): Tool<
  InputSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferInput<InputSchema>
    : unknown,
  OutputSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<OutputSchema>
    : TOutput
> =>
  normalizeToolDefinition(options as RegistrableTool, {
    validateInput: options.validate ?? false,
  }) as Tool<
    InputSchema extends StandardSchemaV1
      ? StandardSchemaV1.InferInput<InputSchema>
      : unknown,
    OutputSchema extends StandardSchemaV1
      ? StandardSchemaV1.InferOutput<OutputSchema>
      : TOutput
  >;

export type { ToolAnnotations };
