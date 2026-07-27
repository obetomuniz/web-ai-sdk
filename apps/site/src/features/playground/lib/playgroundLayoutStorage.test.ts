// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  loadPlaygroundLayoutState,
  PLAYGROUND_LAYOUT_STORAGE_KEY,
  updatePlaygroundLayoutState,
} from "./playgroundLayoutStorage.js";

describe("playground layout storage", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        clear: () => values.clear(),
      },
    });
  });

  it("merges panel visibility updates", () => {
    updatePlaygroundLayoutState({ conversationsOpen: false });
    updatePlaygroundLayoutState({ runtimeOpen: false });

    expect(loadPlaygroundLayoutState()).toEqual({
      conversationsOpen: false,
      runtimeOpen: false,
    });
  });

  it("ignores corrupt or unsupported values", () => {
    window.localStorage.setItem(PLAYGROUND_LAYOUT_STORAGE_KEY, "{");
    expect(loadPlaygroundLayoutState()).toEqual({});

    window.localStorage.setItem(
      PLAYGROUND_LAYOUT_STORAGE_KEY,
      JSON.stringify({ conversationsOpen: "no", runtimeOpen: 1 }),
    );
    expect(loadPlaygroundLayoutState()).toEqual({
      conversationsOpen: undefined,
      runtimeOpen: undefined,
    });
  });
});
