// @vitest-environment happy-dom

import { act, createRef, useLayoutEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { playground as ui } from "../../../shared/ui.js";
import type { PlaygroundLayoutController } from "../lib/usePlaygroundLayout.js";
import { PlaygroundLayout } from "./PlaygroundLayout.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("PlaygroundLayout", () => {
  it("fades transcript content before the scroll boundary", () => {
    expect(ui.transcriptPanel).toContain(
      "after:bg-[linear-gradient(to_top,var(--color-bg)_0%,color-mix(in_oklch,var(--color-bg)_82%,transparent)_45%,transparent_100%)]",
    );
    expect(ui.answer).toContain("pb-10");
  });

  it("positions the runtime restore control below the mobile conversation row", () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const noop = vi.fn();
    const layout = {
      shellRef: createRef<HTMLDivElement>(),
      shellStyle: {},
      gridClassName: "",
      sidebarWidth: 260,
      conversationsOpen: true,
      runtimeOpen: false,
      showConversations: noop,
      hideConversations: noop,
      showRuntime: noop,
      hideRuntime: noop,
      startSidebarResize: noop,
      resizeSidebar: noop,
      finishSidebarResize: noop,
      handleLostPointerCapture: noop,
      resizeSidebarFromKeyboard: noop,
      resetSidebarWidth: noop,
    } satisfies PlaygroundLayoutController;

    act(() => {
      root?.render(
        <PlaygroundLayout
          layout={layout}
          conversations={null}
          conversation={null}
          runtime={null}
        />,
      );
    });

    const restore = container
      .querySelector('[aria-label="Show runtime panel"]')
      ?.closest("span");
    expect(restore?.className).toContain(
      "max-[760px]:top-[calc(var(--playground-mobile-sidebar-height)+0.625rem)]",
    );
  });

  it("reveals a restored conversation at the bottom", () => {
    const boot = document.createElement("div");
    boot.dataset.playgroundBoot = "";
    boot.dataset.playgroundTranscriptScrolled = "true";
    const app = document.createElement("div");
    app.dataset.playgroundApp = "";
    app.hidden = true;
    document.body.append(boot, app);

    function RestoredConversation() {
      const transcriptRef = useRef<HTMLDivElement>(null);

      useLayoutEffect(() => {
        const transcript = transcriptRef.current;
        if (!transcript) return;
        Object.defineProperties(transcript, {
          clientHeight: {
            configurable: true,
            get: () => (app.hidden ? 0 : 200),
          },
          scrollHeight: {
            configurable: true,
            get: () => (app.hidden ? 0 : 600),
          },
        });

        // ConversationView runs before its parent layout effect. This mirrors
        // its initial attempt to restore the latest position while the app
        // layer is still hidden.
        transcript.scrollTop = transcript.scrollHeight;
      }, []);

      return (
        <>
          <header data-playground-main-header />
          <div ref={transcriptRef} data-playground-transcript />
        </>
      );
    }

    const noop = vi.fn();
    const layout = {
      shellRef: createRef<HTMLDivElement>(),
      shellStyle: {},
      gridClassName: "",
      sidebarWidth: 260,
      conversationsOpen: true,
      runtimeOpen: true,
      showConversations: noop,
      hideConversations: noop,
      showRuntime: noop,
      hideRuntime: noop,
      startSidebarResize: noop,
      resizeSidebar: noop,
      finishSidebarResize: noop,
      handleLostPointerCapture: noop,
      resizeSidebarFromKeyboard: noop,
      resetSidebarWidth: noop,
    } satisfies PlaygroundLayoutController;

    root = createRoot(app);
    act(() => {
      root?.render(
        <PlaygroundLayout
          layout={layout}
          conversations={null}
          conversation={<RestoredConversation />}
          runtime={null}
        />,
      );
    });

    const transcript = app.querySelector<HTMLElement>(
      "[data-playground-transcript]",
    );
    const header = app.querySelector<HTMLElement>(
      "[data-playground-main-header]",
    );
    expect(app.hidden).toBe(false);
    expect(boot.hidden).toBe(true);
    expect(transcript?.scrollTop).toBe(600);
    expect(header?.classList.contains(ui.mainHeaderScrolled)).toBe(true);
  });
});
