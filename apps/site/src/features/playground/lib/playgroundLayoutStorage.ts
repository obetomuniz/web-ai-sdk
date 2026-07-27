export const PLAYGROUND_LAYOUT_STORAGE_KEY =
  "web-ai-sdk:playground:layout-state";

export interface PlaygroundLayoutState {
  conversationsOpen?: boolean;
  runtimeOpen?: boolean;
}

export function loadPlaygroundLayoutState(): PlaygroundLayoutState {
  try {
    const stored = window.localStorage.getItem(PLAYGROUND_LAYOUT_STORAGE_KEY);
    if (!stored) return {};

    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object") return {};

    const candidate = value as Record<string, unknown>;
    return {
      conversationsOpen:
        typeof candidate.conversationsOpen === "boolean"
          ? candidate.conversationsOpen
          : undefined,
      runtimeOpen:
        typeof candidate.runtimeOpen === "boolean"
          ? candidate.runtimeOpen
          : undefined,
    };
  } catch {
    return {};
  }
}

export function updatePlaygroundLayoutState(
  update: PlaygroundLayoutState,
): void {
  try {
    window.localStorage.setItem(
      PLAYGROUND_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        ...loadPlaygroundLayoutState(),
        ...update,
      }),
    );
  } catch {
    // Storage is optional. The current session still keeps its React state.
  }
}
