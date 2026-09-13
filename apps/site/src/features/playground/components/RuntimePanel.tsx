import { playground as ui } from "../../../shared/ui.js";
import type { ActivityEvent } from "../lib/types.js";
import type { CapabilityCheck } from "../lib/useCapabilityReadiness.js";
import { PanelToggle } from "./PanelToggle.js";

interface Props {
  open: boolean;
  conversationsOpen: boolean;
  checks: CapabilityCheck[];
  events: ActivityEvent[];
  onHide: () => void;
}

export function RuntimePanel({
  open,
  conversationsOpen,
  checks,
  events,
  onHide,
}: Props) {
  return (
    <div
      className={`${ui.workspaceSlot} ${
        open ? ui.panelSlotOpen : ui.workspaceSlotClosed
      } ${conversationsOpen ? ui.workspaceSlotBelowMobileSidebar : ""}`}
      aria-hidden={!open}
      inert={!open}
    >
      <section
        className={`${ui.workspace} ${open ? ui.panelOpen : ui.workspaceClosed}`}
      >
        <header className={ui.workspaceHeader}>
          <PanelToggle side="right" open onClick={onHide} />
        </header>
        <div className={ui.workspaceBody}>
          <div className={ui.workspaceHeading}>
            <h2 className={ui.workspaceTitle}>Recent activities</h2>
            <div className={ui.workspaceCount}>
              {checks.length} checks · {events.length} event
              {events.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className={ui.workspacePane}>
            <ActivityList checks={checks} events={events} />
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

function ActivityList({
  checks,
  events,
}: {
  checks: CapabilityCheck[];
  events: ActivityEvent[];
}) {
  return (
    <ul className={ui.activity}>
      {events.map((event) => (
        <li key={event.id} className={ui.activityItem}>
          <span className={ui.activityMain}>
            <span className={ui.activityMessage}>{event.message}</span>
            {event.detail && (
              <span className={ui.activityDetail}>{event.detail}</span>
            )}
          </span>
          <span className={ui.activityMeta}>
            <span className={ui.activityKind}>
              {event.kind.replace("chat_", "")}
            </span>
            <span className={ui.activityTime}>{formatTime(event.ts)}</span>
          </span>
        </li>
      ))}
      {checks.map((check) => (
        <li key={check.label} className={ui.activityItem}>
          <span className={ui.activityMain}>
            <span className={ui.activityMessage}>
              {check.label.split(" · call-")[0]}
            </span>
            <span className={ui.activityDetail}>{check.detail}</span>
          </span>
          <span className={ui.activityMeta}>
            <span className={ui.activityCheckState} data-tone={check.state}>
              {check.state}
            </span>
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
