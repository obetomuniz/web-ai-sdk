// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYGROUND_LAYOUT_STORAGE_KEY } from "./playgroundLayoutStorage.js";
import { usePlaygroundLayout } from "./usePlaygroundLayout.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement;
let mobile = false;
const mobileListeners = new Set<(event: MediaQueryListEvent) => void>();
const storedValues = new Map<string, string>();

beforeEach(() => {
  mobile = false;
  mobileListeners.clear();
  storedValues.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storedValues.get(key) ?? null,
      setItem: (key: string, value: string) => storedValues.set(key, value),
      clear: () => storedValues.clear(),
    },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === "(max-width: 760px)" ? mobile : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (
        type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (query === "(max-width: 760px)" && type === "change") {
          mobileListeners.add(listener);
        }
      },
      removeEventListener: (
        type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (query === "(max-width: 760px)" && type === "change") {
          mobileListeners.delete(listener);
        }
      },
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("usePlaygroundLayout", () => {
  function Probe() {
    const layout = usePlaygroundLayout();
    return <output>{layout.conversationsOpen ? "open" : "closed"}</output>;
  }

  function setMobile(matches: boolean) {
    mobile = matches;
    const event = {
      matches,
      media: "(max-width: 760px)",
    } as MediaQueryListEvent;
    for (const listener of mobileListeners) listener(event);
  }

  it("keeps conversations open on mobile without changing the desktop preference", () => {
    window.localStorage.setItem(
      PLAYGROUND_LAYOUT_STORAGE_KEY,
      JSON.stringify({ conversationsOpen: false }),
    );

    act(() => root?.render(<Probe />));
    expect(container.textContent).toBe("closed");

    act(() => setMobile(true));
    expect(container.textContent).toBe("open");

    act(() => setMobile(false));
    expect(container.textContent).toBe("closed");
  });
});
