import type {
  A2uiServerMessage,
  A2uiSnapshot,
  A2uiSurfaceSnapshot,
} from "./types.js";

const DEFAULT_SURFACE = "main";

function surfaceId(payload: { surfaceId?: string } | undefined): string {
  return payload?.surfaceId ?? DEFAULT_SURFACE;
}

function ensureSurface(snap: A2uiSnapshot, id: string): A2uiSurfaceSnapshot {
  return (
    snap[id] ?? {
      surfaceId: id,
      components: {},
      dataModel: {},
      ready: false,
    }
  );
}

/** Pure reducer: apply one A2UI server message to a snapshot. */
export function applyA2uiMessage(
  snap: A2uiSnapshot,
  message: A2uiServerMessage,
): A2uiSnapshot {
  const next = { ...snap };

  if ("deleteSurface" in message) {
    const id = message.deleteSurface.surfaceId;
    if (id in next) {
      const copy = { ...next };
      delete copy[id];
      return copy;
    }
    return next;
  }

  if ("surfaceUpdate" in message) {
    const id = surfaceId(message.surfaceUpdate);
    const prev = ensureSurface(next, id);
    const components = { ...prev.components };
    for (const node of message.surfaceUpdate.components) {
      if (node?.id && node.component) components[node.id] = node;
    }
    const updated = { ...prev, components };
    // Nano often omits `beginRendering`; render when we have a `root` node.
    if (!updated.ready && components.root) {
      updated.ready = true;
      updated.rootId = "root";
    }
    next[id] = updated;
    return next;
  }

  if ("dataModelUpdate" in message) {
    const id = surfaceId(message.dataModelUpdate);
    const prev = ensureSurface(next, id);
    const patch = message.dataModelUpdate.contents;
    next[id] = {
      ...prev,
      dataModel:
        patch && typeof patch === "object"
          ? { ...prev.dataModel, ...patch }
          : prev.dataModel,
    };
    return next;
  }

  if ("beginRendering" in message) {
    const id = surfaceId(message.beginRendering);
    const prev = ensureSurface(next, id);
    next[id] = {
      ...prev,
      ready: true,
      rootId: message.beginRendering.root,
      catalogId: message.beginRendering.catalogId,
    };
    return next;
  }

  return next;
}

export function createEmptyA2uiSnapshot(): A2uiSnapshot {
  return {};
}
