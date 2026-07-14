import {
  A2UI_SERVER_MESSAGE_KEYS,
  type A2uiServerMessage,
  type A2uiServerMessageKey,
} from "./types.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Parse one JSONL line into a validated A2UI v0.8 server message.
 * Returns null when the line is not a recognizable A2UI message.
 */
export function parseA2uiLine(line: string): A2uiServerMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const keys = Object.keys(parsed).filter((k) =>
    (A2UI_SERVER_MESSAGE_KEYS as readonly string[]).includes(k),
  );
  if (keys.length !== 1) return null;

  const key = keys[0] as A2uiServerMessageKey;
  const payload = parsed[key];
  if (!isRecord(payload)) return null;

  switch (key) {
    case "surfaceUpdate": {
      const components = payload.components;
      if (!Array.isArray(components)) return null;
      return {
        surfaceUpdate: {
          surfaceId:
            typeof payload.surfaceId === "string"
              ? payload.surfaceId
              : undefined,
          components,
        },
      };
    }
    case "dataModelUpdate":
      return {
        dataModelUpdate: {
          surfaceId:
            typeof payload.surfaceId === "string"
              ? payload.surfaceId
              : undefined,
          contents: isRecord(payload.contents) ? payload.contents : undefined,
        },
      };
    case "beginRendering": {
      if (typeof payload.root !== "string") return null;
      return {
        beginRendering: {
          root: payload.root,
          surfaceId:
            typeof payload.surfaceId === "string"
              ? payload.surfaceId
              : undefined,
          catalogId:
            typeof payload.catalogId === "string"
              ? payload.catalogId
              : undefined,
        },
      };
    }
    case "deleteSurface": {
      if (typeof payload.surfaceId !== "string") return null;
      return { deleteSurface: { surfaceId: payload.surfaceId } };
    }
    default:
      return null;
  }
}
