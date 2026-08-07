import type { RefObject, SyntheticEvent } from "react";
import { playground as ui } from "../../../shared/ui.js";
import type { AgentTool } from "../experimental/agent/types.js";
import { type AgentMode, MODES } from "../experimental/playground/presets.js";
import { ToolSummary } from "../experimental/playground/ToolSummary.js";
import {
  type PromptReadiness,
  promptReadinessMessage,
} from "../lib/promptReadiness.js";

const browserSupportHref = `${import.meta.env.BASE_URL}docs/browser-support/`;

export interface ComposerProps {
  draft: string;
  promptOn: boolean;
  promptReadiness: PromptReadiness;
  error: Error | null;
  busy: boolean;
  activeMode: AgentMode;
  modeMenuOpen: boolean;
  modeMenuRef: RefObject<HTMLDivElement | null>;
  examples: string[];
  generatingExamples: boolean;
  canRegenerateExamples: boolean;
  tools: readonly AgentTool[];
  onDraftChange: (draft: string) => void;
  onSubmit: () => void;
  onSubmitExample: (example: string) => void;
  onToggleModeMenu: () => void;
  onSelectMode: (modeId: string) => void;
  onRegenerateExamples: () => void;
  onAbort: () => void;
}

export function Composer({
  draft,
  promptOn,
  promptReadiness,
  error,
  busy,
  activeMode,
  modeMenuOpen,
  modeMenuRef,
  examples,
  generatingExamples,
  canRegenerateExamples,
  tools,
  onDraftChange,
  onSubmit,
  onSubmitExample,
  onToggleModeMenu,
  onSelectMode,
  onRegenerateExamples,
  onAbort,
}: ComposerProps) {
  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className={ui.composerDock}>
      <div className={ui.composerNotices}>
        {!promptOn && (
          <div className={ui.composerNotice} role="status" aria-live="polite">
            <NoticeIcon className={ui.composerNoticeIcon} />
            <span className={ui.composerNoticeCopy}>
              <span>{promptReadinessMessage(promptReadiness)}</span>
              {promptReadiness === "unavailable" && (
                <a className={ui.composerNoticeLink} href={browserSupportHref}>
                  Browser support
                </a>
              )}
            </span>
          </div>
        )}
        {error && (
          <div className={ui.composerNoticeError} role="alert">
            <NoticeIcon className={ui.composerNoticeErrorIcon} />
            <span>
              The agent could not finish this response. Please try again.
            </span>
          </div>
        )}
      </div>

      <form className={ui.composer} onSubmit={submit}>
        <div className={ui.modeSelector} ref={modeMenuRef}>
          <button
            type="button"
            className={ui.modeTrigger}
            data-accent={activeMode.accent}
            onClick={onToggleModeMenu}
            disabled={busy}
            aria-label={`Mode: ${activeMode.name}`}
            aria-expanded={modeMenuOpen}
            aria-controls="playground-mode-menu"
          >
            <span
              className={ui.modeTriggerName}
              data-accent={activeMode.accent}
            >
              {activeMode.name}
            </span>
            <svg
              className={
                modeMenuOpen ? ui.modeTriggerChevronOpen : ui.modeTriggerChevron
              }
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="m4.5 6 3.5 3.5L11.5 6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {modeMenuOpen && (
            <div className={ui.modeMenu}>
              <div className={ui.modeMenuHeader}>
                <span className={ui.modeMenuTitle}>
                  How should this agent work?
                </span>
                <span className={ui.modeMenuDescription}>
                  Choose a focused configuration for this conversation.
                </span>
              </div>
              <fieldset
                id="playground-mode-menu"
                className={ui.modeOptions}
                aria-label="Agent mode"
              >
                {MODES.map((mode) => {
                  const selected = mode.id === activeMode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={selected}
                      data-accent={mode.accent}
                      className={selected ? ui.modeOptionActive : ui.modeOption}
                      onClick={() => onSelectMode(mode.id)}
                    >
                      <span className={ui.modeOptionCopy}>
                        <span className={ui.modeOptionTitleRow}>
                          <span className={ui.modeOptionIdentity}>
                            <span
                              className={ui.modeAccentDot}
                              data-accent={mode.accent}
                              aria-hidden="true"
                            />
                            <span
                              className={ui.modeOptionName}
                              data-accent={mode.accent}
                            >
                              {mode.name}
                            </span>
                          </span>
                          <span className={ui.modeOptionToolCount}>
                            {mode.tools.length === 0
                              ? "no tools"
                              : `${mode.tools.length} tool${mode.tools.length === 1 ? "" : "s"}`}
                          </span>
                        </span>
                        <span className={ui.modeOptionDescription}>
                          {mode.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </fieldset>
              <div className={ui.modeMenuNote}>
                Mode changes keep this conversation and its history.
              </div>
            </div>
          )}
        </div>
        <textarea
          id="playground-message"
          name="message"
          className={ui.composerInput}
          aria-label="Ask anything"
          placeholder={
            promptOn
              ? "Ask anything"
              : promptReadiness === "downloadable" ||
                  promptReadiness === "downloading"
                ? "Waiting for the on-device model"
                : "On-device model unavailable"
          }
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          disabled={!promptOn}
          rows={1}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className={ui.composerActions}>
          <ToolSummary tools={tools} />
          {busy ? (
            <button type="button" className={ui.stopButton} onClick={onAbort}>
              Stop
            </button>
          ) : (
            <button
              type="submit"
              className={ui.sendButton}
              data-testid="agent-run"
              disabled={!promptOn || !draft.trim()}
              aria-label="Send message"
            >
              <span aria-hidden="true">↑</span>
            </button>
          )}
        </div>
      </form>

      {promptOn && !busy && !error && !draft.trim() && (
        <div className={ui.exampleFloat}>
          <div className={ui.examples}>
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                className={ui.example}
                onClick={() => onSubmitExample(example)}
                title={example}
              >
                {truncate(example)}
              </button>
            ))}
          </div>
          <span className={ui.exampleRegenerateWrap}>
            <button
              type="button"
              className={ui.exampleRegenerate}
              onClick={onRegenerateExamples}
              disabled={generatingExamples || !canRegenerateExamples}
              aria-label="Generate new examples"
              aria-busy={generatingExamples}
            >
              <span aria-hidden="true">+</span>
            </button>
            <span role="tooltip" className={ui.exampleRegenerateTooltip}>
              Generate new examples
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function NoticeIcon({ className }: { className: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 5.25v5.5" />
        <path d="M10 14.25h.01" />
        <circle cx="10" cy="10" r="7.25" />
      </svg>
    </span>
  );
}

function truncate(value: string, limit = 60): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}...`;
}
