// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { playground as ui } from "../../../shared/ui.js";
import type { AgentThread } from "../lib/agentThreads.js";
import { ConversationsPanel } from "./ConversationsPanel.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("ConversationsPanel", () => {
  it("places the mobile runtime action in the conversation rail", () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const noop = vi.fn();
    const thread: AgentThread = {
      id: "thread-1",
      name: "Persisted conversation",
      modeId: "platform",
      turns: [],
      createdAt: 1,
      updatedAt: 1,
    };

    act(() => {
      root?.render(
        <ConversationsPanel
          open
          threads={[thread]}
          activeId={thread.id}
          busy={false}
          promptOn
          status="idle"
          stopReason={null}
          runtimeOpen={false}
          onCreate={noop}
          onSelect={noop}
          onClose={noop}
          onHide={noop}
          onShowRuntime={noop}
        />,
      );
    });

    const action = container.querySelector(
      "[data-playground-mobile-runtime-action]",
    );
    const row = action?.parentElement;
    const rail = row?.querySelector("[data-playground-conversation-rail]");

    expect(action).not.toBeNull();
    expect(action?.className).toContain("max-[760px]:flex");
    expect(action?.previousElementSibling).toBe(rail);
    expect(ui.sidebarBody).toContain(
      "max-[760px]:grid-cols-[minmax(0,1fr)_auto]",
    );
    expect(ui.sidebarSection).toContain("max-[760px]:overflow-x-auto");
    expect(rail?.querySelector("[data-thread-id]")).not.toBeNull();
    expect(
      action?.querySelector('[aria-label="Show runtime panel"]'),
    ).not.toBeNull();
  });
});
