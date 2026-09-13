import type { ProofreadCorrection } from "@web-ai-sdk/proofreader";
import type { ReactElement } from "react";
import { playground as ui } from "../../../../shared/ui.js";
import { toolOutcome } from "../agent/toolOutcome.js";

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
  animate?: boolean;
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
  const outcome = toolOutcome(tool);
  if (outcome === "unavailable" || outcome === "cancelled") return "warn";
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

function DefaultToolRenderer({ tool, animate = true }: ToolRendererProps) {
  const status = resolveToolCardStatus(tool);
  const outputIssue = resolveOutputIssue(tool.output);

  return (
    <li
      className={
        status === "calling"
          ? animate
            ? ui.toolCardCalling
            : ui.toolCardStatic
          : status === "warn"
            ? animate
              ? ui.toolCardWarn
              : ui.toolCardWarnStatic
            : status === "error"
              ? animate
                ? ui.toolCardError
                : ui.toolCardErrorStatic
              : animate
                ? ui.toolCard
                : ui.toolCardStatic
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
            {status === "warn" && toolOutcome(tool)}
            {status === "error" && toolOutcome(tool)}
          </span>
        </summary>

        <SpecializedResult tool={tool} />
        {tool.progress.filter((progress) => !isOutputProgress(progress))
          .length > 0 && (
          <ul className={ui.toolProgress}>
            {tool.progress
              .filter((progress) => !isOutputProgress(progress))
              .map((progress) => (
                <li
                  key={summarizeJson(progress)}
                  className={ui.toolProgressItem}
                >
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
                    ? "No specialized result"
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

function isOutputProgress(
  value: unknown,
): value is { phase: "output"; text: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { phase?: string }).phase === "output" &&
      typeof (value as { text?: unknown }).text === "string",
  );
}

export function validCorrectionRange(
  original: string,
  correction: ProofreadCorrection,
): boolean {
  return (
    Number.isInteger(correction.startIndex) &&
    Number.isInteger(correction.endIndex) &&
    correction.startIndex >= 0 &&
    correction.endIndex >= correction.startIndex &&
    correction.endIndex <= original.length
  );
}

function SpecializedResult({ tool }: { tool: TranscriptToolFrame }) {
  const progress = tool.progress.filter(isOutputProgress).at(-1);
  const output =
    tool.output && typeof tool.output === "object"
      ? (tool.output as {
          text?: unknown;
          correctedInput?: unknown;
          summary?: unknown;
          translation?: unknown;
          candidates?: Array<{ language: string; confidence: number }>;
          unchanged?: boolean;
          corrections?: ProofreadCorrection[];
          original?: string;
          checkedText?: string;
          cached?: boolean;
        })
      : undefined;
  const text = tool.pending
    ? progress?.text
    : (output?.text ??
      output?.correctedInput ??
      output?.summary ??
      output?.translation);
  const candidates = Array.isArray(output?.candidates)
    ? output.candidates.filter(
        (candidate) =>
          candidate &&
          typeof candidate.language === "string" &&
          typeof candidate.confidence === "number",
      )
    : [];
  if (typeof text !== "string" && candidates.length === 0) return null;
  const original = typeof output?.original === "string" ? output.original : "";
  const checkedText =
    typeof output?.checkedText === "string" ? output.checkedText : original;
  const corrections = Array.isArray(output?.corrections)
    ? output.corrections.filter(
        (correction) =>
          correction &&
          typeof correction === "object" &&
          typeof correction.correction === "string",
      )
    : [];
  return (
    <div className={ui.toolDetails}>
      <p className={ui.toolSummary}>
        {tool.name === "proofread_text" ? "Corrected text" : "Result"}
        {output?.cached ? " · cached" : ""}
        {output?.unchanged === true ? " · unchanged (same language)" : ""}
      </p>
      {typeof text === "string" && <pre className={ui.toolJson}>{text}</pre>}
      {candidates.length > 0 && (
        <ol className={ui.toolProgress}>
          {candidates.map((candidate) => (
            <li key={candidate.language}>
              {candidate.language}: {(candidate.confidence * 100).toFixed(1)}%
              confidence
            </li>
          ))}
        </ol>
      )}
      {tool.name === "proofread_text" && output && (
        <>
          <p className={ui.toolSummary}>Original text (unchanged)</p>
          <pre className={ui.toolJson}>{original}</pre>
          {checkedText !== original && (
            <p className={ui.toolSummary}>
              Offsets refer to checked text. The SDK omits surrounding
              whitespace.
            </p>
          )}
          <ul className={ui.toolProgress}>
            {corrections.map((correction, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: Native corrections are immutable and can contain duplicate ranges.
                key={`${index}:${correction.startIndex}:${correction.endIndex}`}
                className={ui.toolProgressItem}
              >
                <div>
                  <p>
                    Offsets{" "}
                    {Number.isInteger(correction.startIndex)
                      ? correction.startIndex
                      : "invalid"}
                    –
                    {Number.isInteger(correction.endIndex)
                      ? correction.endIndex
                      : "invalid"}
                    :{" "}
                    {validCorrectionRange(checkedText, correction)
                      ? JSON.stringify(
                          checkedText.slice(
                            correction.startIndex,
                            correction.endIndex,
                          ),
                        )
                      : "Invalid display range"}{" "}
                    → {correction.correction}
                  </p>
                  {typeof correction.type === "string" && (
                    <p>Type: {correction.type}</p>
                  )}
                  {typeof correction.explanation === "string" && (
                    <p>{correction.explanation}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
