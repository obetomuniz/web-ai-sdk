import { playground as ui } from "../../../shared/ui.js";
import {
  type PromptReadiness,
  promptReadinessLabel,
} from "../lib/promptReadiness.js";
import type { ActivityEvent } from "../lib/types.js";
import { PanelToggle } from "./PanelToggle.js";

interface Props {
  open: boolean;
  promptOn: boolean;
  promptReadiness: PromptReadiness;
  summarizerOn: boolean;
  webmcpAvailable: boolean;
  events: ActivityEvent[];
  onHide: () => void;
}

export function RuntimePanel({
  open,
  promptOn,
  promptReadiness,
  summarizerOn,
  webmcpAvailable,
  events,
  onHide,
}: Props) {
  return (
    <div
      className={`${ui.workspaceSlot} ${
        open ? ui.panelSlotOpen : ui.workspaceSlotClosed
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <section
        className={`${ui.workspace} ${open ? ui.panelOpen : ui.workspaceClosed}`}
      >
        <header className={ui.workspaceHeader}>
          <span className={ui.workspaceHeading}>
            <h2 className={ui.workspaceTitle}>Runtime</h2>
          </span>
          <PanelToggle side="right" open onClick={onHide} />
        </header>
        <div className={ui.workspaceBody}>
          <div className={ui.chips}>
            <RuntimeChip
              on={promptOn}
              label="prompt"
              guidance="Runs conversation responses on-device with the browser's Prompt API."
              stateLabel={promptReadinessLabel(promptReadiness)}
            />
            <RuntimeChip
              on={summarizerOn}
              label="summarizer"
              guidance="Summarizes provided text on-device with the browser's Summarizer API."
            />
            <RuntimeChip
              on={webmcpAvailable}
              label="webmcp"
              guidance="Exposes Playground conversation controls to compatible browser agents."
            />
          </div>
          <div className={ui.workspaceHeading}>
            <h2 className={ui.workspaceTitle}>Activity</h2>
            <div className={ui.workspaceCount}>
              {events.length} event{events.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className={ui.workspacePane}>
            <ActivityList events={events} />
          </div>
          <div className={ui.workspaceNotes}>
            <div className={ui.workspaceFootnote}>
              Conversations stored in this browser
            </div>
            <div className={ui.workspaceAdvice}>
              On-device AI can make mistakes. Verify important answers.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function RuntimeChip({
  on,
  label,
  guidance,
  stateLabel,
}: {
  on: boolean;
  label: string;
  guidance: string;
  stateLabel?: string;
}) {
  const state = stateLabel ?? (on ? "Available" : "Unavailable");
  return (
    <span
      className={on ? ui.chipOn : ui.chipOff}
      title={`${guidance} ${state} in this browser.`}
    >
      {label} {stateLabel ? stateLabel.toLowerCase() : on ? "on" : "off"}
    </span>
  );
}

function ActivityList({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <div className={ui.empty}>Activity appears here.</div>;
  }
  return (
    <ul className={ui.activity}>
      {events.map((event) => (
        <li key={event.id} className={ui.activityItem}>
          <span className={ui.activityTime}>{formatTime(event.ts)}</span>
          <span className={ui.activityKind}>
            {event.kind.replace("chat_", "")}
          </span>
          <span className={ui.activityMain}>
            <span className={ui.activityMessage}>{event.message}</span>
            {event.detail && (
              <span className={ui.activityDetail}>{event.detail}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
