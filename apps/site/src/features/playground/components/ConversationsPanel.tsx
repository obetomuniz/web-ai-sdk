import { playground as ui } from "../../../shared/ui.js";
import type { AgentStopReason } from "../experimental/agent/types.js";
import type { AgentThread } from "../lib/agentThreads.js";
import { findMode } from "../lib/agentThreads.js";
import { PanelToggle } from "./PanelToggle.js";

interface Props {
  open: boolean;
  threads: AgentThread[];
  activeId: string;
  busy: boolean;
  promptOn: boolean;
  status: string;
  stopReason: AgentStopReason | null;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onHide: () => void;
}

export function ConversationsPanel({
  open,
  threads,
  activeId,
  busy,
  promptOn,
  status,
  stopReason,
  onCreate,
  onSelect,
  onClose,
  onHide,
}: Props) {
  const activeStatus = conversationStatus(promptOn, status, stopReason);
  return (
    <div
      className={`${ui.sidebarSlot} ${
        open ? ui.panelSlotOpen : ui.sidebarSlotClosed
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <aside
        className={`${ui.sidebar} ${open ? ui.panelOpen : ui.sidebarClosed}`}
      >
        <header className={ui.sidebarHeader}>
          <h2 className={ui.sectionTitle}>Conversations</h2>
          <PanelToggle side="left" open onClick={onHide} />
        </header>
        <div className={ui.sidebarBody}>
          <section className={ui.sidebarSection}>
            <button
              type="button"
              className={ui.wideButton}
              onClick={onCreate}
              disabled={busy || !promptOn}
              aria-label="New conversation"
              title="New conversation"
            >
              <span className={ui.wideButtonIcon} aria-hidden="true">
                +
              </span>
              <span className={ui.wideButtonLabel}>New conversation</span>
            </button>
            <div className={ui.presets}>
              {threads.map((thread) => {
                const active = thread.id === activeId;
                return (
                  <div
                    key={thread.id}
                    data-thread-id={thread.id}
                    data-active={active}
                    className={active ? ui.threadItemActive : ui.threadItem}
                  >
                    <button
                      type="button"
                      className={ui.threadSelect}
                      onClick={() => onSelect(thread.id)}
                      disabled={busy}
                    >
                      <span className={ui.threadTitleRow}>
                        {active && activeStatus.tone !== "idle" && (
                          <span
                            className={ui.threadStatus}
                            role="img"
                            data-tone={activeStatus.tone}
                            title={activeStatus.name}
                            aria-label={`Status: ${activeStatus.name}`}
                          />
                        )}
                        <span className={ui.presetName}>{thread.name}</span>
                      </span>
                      <span className={ui.presetDesc}>
                        {findMode(thread.modeId).name} · {thread.turns.length}{" "}
                        turn{thread.turns.length === 1 ? "" : "s"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={ui.threadClose}
                      onClick={() => onClose(thread.id)}
                      disabled={busy}
                      aria-label={`Close conversation ${thread.name}`}
                    >
                      <svg
                        className={ui.threadCloseIcon}
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M4 4l8 8M12 4l-8 8"
                          stroke="currentColor"
                          strokeWidth="1.35"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function conversationStatus(
  promptOn: boolean,
  status: string,
  stopReason: AgentStopReason | null,
): { name: string; tone: "active" | "error" | "idle" | "off" } {
  const current =
    !promptOn || status === "unavailable"
      ? "unavailable"
      : status === "planning" ||
          status === "tool_calling" ||
          status === "streaming"
        ? status
        : stopReason && stopReason !== "done"
          ? stopReason
          : status === "done"
            ? "idle"
            : status;
  const label = current === "idle" ? "ready" : current.replaceAll("_", " ");
  const name = `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  const normalized = name.toLowerCase();
  const tone =
    normalized === "planning" ||
    normalized === "tool calling" ||
    normalized === "streaming"
      ? "active"
      : normalized === "unavailable"
        ? "off"
        : normalized === "ready"
          ? "idle"
          : "error";
  return { name, tone };
}
