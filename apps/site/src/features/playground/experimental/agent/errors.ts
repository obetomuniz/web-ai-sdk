/**
 * Typed errors for the experimental agent. Mirrors the
 * `@web-ai-sdk/prompt` convention of named errors so callers can branch
 * on `error.name` even after structured-clone or rethrow.
 */

export class AgentUnavailableError extends Error {
  readonly name = "AgentUnavailableError";
  constructor(message = "Prompt API is unavailable in this environment.") {
    super(message);
  }
}

export class AgentToolValidationError extends Error {
  readonly name = "AgentToolValidationError";
  readonly toolName: string;
  readonly issues: ReadonlyArray<string>;
  constructor(toolName: string, issues: ReadonlyArray<string>) {
    super(
      `Tool "${toolName}" rejected the model's arguments: ${issues.join("; ")}`,
    );
    this.toolName = toolName;
    this.issues = issues;
  }
}

export class AgentUnknownToolError extends Error {
  readonly name = "AgentUnknownToolError";
  readonly toolName: string;
  constructor(toolName: string) {
    super(`Model requested unknown tool "${toolName}".`);
    this.toolName = toolName;
  }
}

export class AgentToolExecutionError extends Error {
  readonly name = "AgentToolExecutionError";
  readonly toolName: string;
  readonly cause?: unknown;
  constructor(toolName: string, cause: unknown) {
    const causeMessage =
      cause instanceof Error ? cause.message : String(cause ?? "");
    super(`Tool "${toolName}" threw: ${causeMessage}`);
    this.toolName = toolName;
    this.cause = cause;
  }
}

/**
 * Raised when the on-device model's stream stops yielding chunks for
 * longer than the no-progress window - without closing the stream or
 * honoring the abort signal. This happens when Chrome's single-instance
 * model wedges mid-generation; the only recovery is to stop awaiting the
 * stalled iterator. Bounds otherwise-infinite hangs.
 */
export class AgentStalledError extends Error {
  readonly name = "AgentStalledError";
  constructor(timeoutMs: number) {
    super(
      `The on-device model didn't finish this step within ${Math.round(
        timeoutMs / 1000,
      )}s (it froze or is generating too slowly). The run was abandoned. The model degrades under sustained use - reload the page to reset it, or try again in a moment.`,
    );
  }
}
