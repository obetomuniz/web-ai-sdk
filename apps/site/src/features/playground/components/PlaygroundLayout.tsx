import { type ReactNode, useLayoutEffect } from "react";
import { playground as ui } from "../../../shared/ui.js";
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  type PlaygroundLayoutController,
} from "../lib/usePlaygroundLayout.js";
import { PanelToggle } from "./PanelToggle.js";

interface Props {
  layout: PlaygroundLayoutController;
  conversations: ReactNode;
  conversation: ReactNode;
  runtime: ReactNode;
}

export function PlaygroundLayout({
  layout,
  conversations,
  conversation,
  runtime,
}: Props) {
  const { shellRef } = layout;

  // Swap the persisted boot shell for the interactive app in one layout
  // phase. The shell remains visible while this client-only island loads,
  // so locally stored conversations never disappear between Astro and React.
  useLayoutEffect(() => {
    const app = shellRef.current?.closest<HTMLElement>("[data-playground-app]");
    const boot = app?.parentElement?.querySelector<HTMLElement>(
      "[data-playground-boot]",
    );
    if (!app || !boot) return;
    const transcript = shellRef.current?.querySelector<HTMLElement>(
      "[data-playground-transcript]",
    );
    const header = shellRef.current?.querySelector<HTMLElement>(
      "[data-playground-main-header]",
    );

    // The static shell records whether its restored transcript overflowed.
    // Apply that state while the interactive layer is still display:none, so
    // its first visible frame already has the correct shadow.
    header?.classList.toggle(
      ui.mainHeaderScrolled,
      boot.dataset.playgroundTranscriptScrolled === "true",
    );
    app.hidden = false;

    // Child layout effects run before this handoff while the app layer is
    // still hidden, so their first scroll measurement is necessarily zero.
    // Once the interactive layer is measurable, transfer the boot shell's
    // "latest message" position before the browser paints it.
    if (transcript) {
      transcript.scrollTop = transcript.scrollHeight;
      header?.classList.toggle(ui.mainHeaderScrolled, transcript.scrollTop > 1);
      // Programmatic scroll restoration may notify listeners after paint.
      // Synchronize the React scroll state during this layout phase so a
      // later readiness render cannot briefly remove the restored shadow.
      transcript.dispatchEvent(new Event("scroll"));
    }
    boot.hidden = true;
  }, [shellRef]);

  return (
    <div ref={layout.shellRef} className={ui.shell} style={layout.shellStyle}>
      <div className={layout.gridClassName}>
        {conversations}

        {layout.conversationsOpen && (
          <hr
            className={ui.sidebarResizeHandle}
            aria-label="Resize conversations column"
            aria-orientation="vertical"
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuenow={layout.sidebarWidth}
            aria-valuetext={`${layout.sidebarWidth} pixels`}
            tabIndex={0}
            title="Drag to resize. Double-click to reset."
            onPointerDown={layout.startSidebarResize}
            onPointerMove={layout.resizeSidebar}
            onPointerUp={layout.finishSidebarResize}
            onPointerCancel={layout.finishSidebarResize}
            onLostPointerCapture={layout.handleLostPointerCapture}
            onKeyDown={layout.resizeSidebarFromKeyboard}
            onDoubleClick={layout.resetSidebarWidth}
          />
        )}

        {!layout.runtimeOpen && (
          <span className={ui.panelRestoreRight}>
            <PanelToggle
              side="right"
              open={false}
              onClick={layout.showRuntime}
            />
          </span>
        )}

        {!layout.conversationsOpen && (
          <span className={ui.panelRestoreLeft}>
            <PanelToggle
              side="left"
              open={false}
              onClick={layout.showConversations}
            />
          </span>
        )}

        {conversation}
        {runtime}
      </div>
    </div>
  );
}
