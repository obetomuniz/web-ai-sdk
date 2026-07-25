import type { ReactElement } from "react";
import { playground as ui } from "../../../../shared/ui.js";

export interface TranscriptToolFrame {
  callId: string;
  name: string;
  input: Record<string, unknown>;
  progress: unknown[];
  output?: unknown;
  error?: { message: string; name?: string };
  durationMs?: number;
  pending: boolean;
}

export type ToolRendererId = "default" | "minimal";

type ToolRendererProps = {
  tool: TranscriptToolFrame;
};

type ToolRendererComponent = (props: ToolRendererProps) => ReactElement;

const renderers: Record<ToolRendererId, ToolRendererComponent> = {
  default: DefaultToolRenderer,
  minimal: MinimalToolRenderer,
};

export function resolveToolRenderer(
  id?: ToolRendererId,
): ToolRendererComponent {
  return id ? renderers[id] : renderers.default;
}

function resolveToolCardStatus(
  tool: TranscriptToolFrame,
): "calling" | "ok" | "error" | "warn" {
  if (tool.pending) return "calling";
  if (tool.error) return "error";
  const outputIssue = resolveOutputIssue(tool.output);
  if (outputIssue?.kind === "error") return "error";
  if (outputIssue?.kind === "warn") return "warn";
  if (
    tool.name === "summarize_text" &&
    tool.output &&
    typeof tool.output === "object" &&
    !(tool.output as { summary?: string }).summary?.trim()
  ) {
    return "warn";
  }
  return "ok";
}

function DefaultToolRenderer({ tool }: ToolRendererProps) {
  const status = resolveToolCardStatus(tool);
  const outputIssue = resolveOutputIssue(tool.output);

  return (
    <li
      className={
        status === "calling"
          ? ui.toolCardCalling
          : status === "warn"
            ? ui.toolCardWarn
            : status === "error"
              ? ui.toolCardError
              : ui.toolCard
      }
    >
      <details className={ui.toolCardDisclosure}>
        <summary className={ui.toolCardHead}>
          <span className={ui.toolCardIdentity}>
            <span className={ui.toolCardChevron} aria-hidden="true">
              ›
            </span>
            <code className={ui.toolCardName}>{tool.name}</code>
          </span>
          <span
            className={
              status === "calling"
                ? ui.toolStatusCalling
                : status === "warn"
                  ? ui.toolStatusWarn
                  : status === "error"
                    ? ui.toolStatusError
                    : ui.toolStatus
            }
          >
            {status === "calling" && "calling..."}
            {status === "ok" && `${Math.round(tool.durationMs ?? 0)}ms`}
            {status === "warn" && "unavailable"}
            {status === "error" && "error"}
          </span>
        </summary>

        {tool.progress.length > 0 && (
          <ul className={ui.toolProgress}>
            {tool.progress.map((progress) => (
              <li key={summarizeJson(progress)} className={ui.toolProgressItem}>
                <span className={ui.toolProgressDot} />
                <code>{summarizeJson(progress)}</code>
              </li>
            ))}
          </ul>
        )}

        <details className={ui.toolDetails}>
          <summary className={ui.toolSummary}>
            input · {summarizeJson(tool.input)}
          </summary>
          <pre className={ui.toolJson}>
            {JSON.stringify(tool.input, null, 2)}
          </pre>
        </details>
        {!tool.pending && (
          <details className={ui.toolDetails}>
            <summary className={ui.toolSummary}>
              {tool.error
                ? `error · ${truncate(tool.error.message, 80)}`
                : outputIssue
                  ? `${outputIssue.kind} · ${truncate(outputIssue.message, 80)}`
                  : status === "warn"
                    ? "summarizer unavailable · answered below"
                    : `output · ${summarizeJson(tool.output)}`}
            </summary>
            <pre className={ui.toolJson}>
              {tool.error
                ? formatError(tool.error)
                : JSON.stringify(tool.output, null, 2)}
            </pre>
          </details>
        )}
      </details>
    </li>
  );
}

function MinimalToolRenderer({ tool }: ToolRendererProps) {
  const status = resolveToolCardStatus(tool);
  const statusText =
    status === "calling"
      ? "running"
      : status === "error"
        ? "error"
        : status === "warn"
          ? "unavailable"
          : `${Math.round(tool.durationMs ?? 0)}ms`;
  const outputLine = tool.error
    ? `error: ${truncate(tool.error.message, 120)}`
    : tool.pending
      ? tool.progress.length > 0
        ? `progress: ${truncate(summarizeJson(tool.progress[tool.progress.length - 1]), 120)}`
        : "waiting for output..."
      : `output: ${truncate(summarizeJson(tool.output), 120)}`;

  return (
    <li className={ui.toolItem}>
      <div className={ui.toolItemHead}>
        <code className={ui.toolItemName}>{tool.name}</code>
        <span className={ui.toolItemStatus}>{statusText}</span>
      </div>
      <div className={ui.toolItemBody}>
        <code>{outputLine}</code>
      </div>
    </li>
  );
}

function summarizeJson(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return `"${truncate(value, 40)}"`;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return truncate(JSON.stringify(value), 60);
  } catch {
    return "[unserializable]";
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}...`;
}

function formatError(err: { message: string; name?: string }): string {
  if (err.name) return `${err.name}: ${err.message}`;
  return err.message;
}

function resolveOutputIssue(
  output: unknown,
): { kind: "error" | "warn"; message: string } | undefined {
  if (!output || typeof output !== "object") return undefined;
  const record = output as { error?: unknown; unavailable?: unknown };
  if (typeof record.error === "string" && record.error.trim()) {
    return { kind: "error", message: record.error };
  }
  if (record.unavailable === true) {
    return { kind: "warn", message: "Unavailable in this browser" };
  }
  return undefined;
}
