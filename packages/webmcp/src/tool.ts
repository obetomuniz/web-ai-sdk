export interface ToolAnnotations {
  /** Defined by the current WebMCP draft. */
  readOnlyHint?: boolean;
  /** Marks external or user-generated tool output as untrusted. */
  untrustedContentHint?: boolean;
  /** Compatibility passthrough for MCP-shaped and earlier WebMCP hosts. */
  destructiveHint?: boolean;
  /** Compatibility passthrough for MCP-shaped and earlier WebMCP hosts. */
  idempotentHint?: boolean;
  /** Compatibility passthrough for MCP-shaped and earlier WebMCP hosts. */
  openWorldHint?: boolean;
}

export interface ToolMetadata {
  name: string;
  /** Optional human-readable title for display in host user interfaces. */
  title?: string;
  description: string;
  inputSchema?: object;
  /** Shorthand for `annotations.readOnlyHint = true`. */
  readOnly?: boolean;
  /** Compatibility shorthand for `annotations.destructiveHint = true`. */
  destructive?: boolean;
  /** Raw passthrough; merged on top of the shorthand flags. */
  annotations?: ToolAnnotations;
}

export interface Tool<TInput = unknown, TOutput = unknown>
  extends ToolMetadata {
  execute: (input: TInput) => Promise<TOutput> | TOutput;
}

export interface RegisteredToolMetadata {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: ToolAnnotations;
}

/** Build the discoverable metadata exactly as it is sent to the WebMCP host. */
export const toRegisteredToolMetadata = (
  tool: ToolMetadata,
): RegisteredToolMetadata => {
  const annotations: ToolAnnotations = {
    ...(tool.readOnly ? { readOnlyHint: true } : {}),
    ...(tool.destructive ? { destructiveHint: true } : {}),
    ...tool.annotations,
  };

  const metadata: RegisteredToolMetadata = {
    name: tool.name,
    description: tool.description,
  };
  if (tool.title !== undefined) metadata.title = tool.title;
  if (tool.inputSchema !== undefined) metadata.inputSchema = tool.inputSchema;
  if (Object.keys(annotations).length > 0) metadata.annotations = annotations;
  return metadata;
};
