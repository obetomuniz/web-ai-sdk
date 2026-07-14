import { parsePlaygroundPayload } from "./constraint.js";
import { extractA2uiJsonlLines } from "./extract.js";
import { parseA2uiLine } from "./parse.js";
import { synthesizeA2uiMessages } from "./synthesize.js";
import type { A2uiComponentNode, A2uiServerMessage } from "./types.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Wrap a bare `{ id, component }` object as a surfaceUpdate line. */
function wrapOrphanComponent(line: string): A2uiServerMessage | null {
  try {
    const o = JSON.parse(line) as unknown;
    if (!isRecord(o) || !("id" in o) || !("component" in o)) return null;
    if ("surfaceUpdate" in o || "beginRendering" in o) return null;
    return {
      surfaceUpdate: {
        surfaceId: "main",
        components: [
          {
            id: String(o.id),
            component: o.component as Record<string, unknown>,
          },
        ],
      },
    };
  } catch {
    return null;
  }
}

function normalizeComponent(node: A2uiComponentNode): A2uiComponentNode {
  const comp = node.component;
  const entries = Object.entries(comp);
  if (entries.length !== 1) return node;
  const entry = entries[0];
  if (!entry) return node;
  const [type, props] = entry;
  const p = (props ?? {}) as Record<string, unknown>;

  if (type === "Button" && p.text && !p.label) {
    return {
      id: node.id,
      component: { Button: { label: p.text } },
    };
  }

  if (type === "Card" && p.children && !p.child) {
    const kids = p.children as { explicitList?: string[] };
    if (Array.isArray(kids.explicitList) && kids.explicitList[0]) {
      return {
        id: node.id,
        component: { Card: { child: kids.explicitList[0] } },
      };
    }
  }

  return node;
}

/**
 * Best-effort parse: constrained JSON → synthesize, then JSONL lines, then orphans.
 */
export function repairAndParseA2ui(text: string): A2uiServerMessage[] {
  const payload = parsePlaygroundPayload(text);
  if (payload) return synthesizeA2uiMessages(payload);

  const messages: A2uiServerMessage[] = [];
  const componentBank = new Map<string, A2uiComponentNode>();
  let sawBegin = false;

  for (const line of extractA2uiJsonlLines(text)) {
    let msg = parseA2uiLine(line);
    if (!msg) msg = wrapOrphanComponent(line);
    if (!msg) continue;

    if ("beginRendering" in msg) {
      sawBegin = true;
      messages.push(msg);
      continue;
    }

    if ("surfaceUpdate" in msg) {
      for (const raw of msg.surfaceUpdate.components) {
        if (!raw?.id || !raw.component) continue;
        const node = normalizeComponent(raw as A2uiComponentNode);
        componentBank.set(node.id, node);
      }
      continue;
    }

    messages.push(msg);
  }

  if (componentBank.size > 0) {
    const components = [...componentBank.values()];
    if (!componentBank.has("root")) {
      const rootChild =
        components.find((c) => c.id === "card")?.id ?? components[0]?.id;
      if (rootChild) {
        components.unshift({
          id: "root",
          component: {
            Column: { children: { explicitList: [rootChild] } },
          },
        });
      }
    }
    messages.unshift({
      surfaceUpdate: { surfaceId: "main", components },
    });
    if (!sawBegin) {
      const rootId = componentBank.has("root") ? "root" : components[0]?.id;
      if (rootId) {
        messages.push({ beginRendering: { surfaceId: "main", root: rootId } });
      }
    }
  }

  return messages;
}
