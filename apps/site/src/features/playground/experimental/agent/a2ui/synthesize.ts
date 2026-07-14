import type {
  A2uiMetric,
  A2uiPlaygroundLayout,
  A2uiPlaygroundPayload,
} from "./constraint.js";
import type { A2uiComponentNode, A2uiServerMessage } from "./types.js";

const SURFACE = "main";

function textNode(id: string, value: string): A2uiComponentNode {
  return {
    id,
    component: { Text: { text: { literalString: value } } },
  };
}

function buttonNode(id: string, label: string): A2uiComponentNode {
  return {
    id,
    component: { Button: { label: { literalString: label } } },
  };
}

function resolveLayout(
  payload: A2uiPlaygroundPayload,
): A2uiPlaygroundLayout | undefined {
  if (payload.layout) return payload.layout;
  if (!payload.metrics?.length) return undefined;
  return payload.metrics.length >= 4 ? "chart" : "stats";
}

function chartNode(id: string, metrics: A2uiMetric[]): A2uiComponentNode {
  const max = Math.max(...metrics.map((m) => m.value), 1);
  return {
    id,
    component: {
      Chart: {
        items: metrics.map((m) => ({
          label: m.label,
          value: m.value,
          max,
          unit: m.unit,
        })),
      },
    },
  };
}

function statRowNode(id: string, metrics: A2uiMetric[]): A2uiComponentNode {
  return {
    id,
    component: {
      StatRow: {
        items: metrics.map((m) => ({
          label: m.label,
          value: m.value,
          unit: m.unit,
        })),
      },
    },
  };
}

/**
 * Turn a constrained playground payload into valid A2UI v0.8 server messages.
 */
export function synthesizeA2uiMessages(
  payload: A2uiPlaygroundPayload,
): A2uiServerMessage[] {
  const components: A2uiComponentNode[] = [
    {
      id: "root",
      component: {
        Column: { children: { explicitList: ["card"] } },
      },
    },
    {
      id: "card",
      component: { Card: { child: "card_body" } },
    },
    {
      id: "card_body",
      component: { Column: { children: { explicitList: [] } } },
    },
  ];

  const bodyChildren: string[] = ["title"];
  components.push(textNode("title", payload.title));

  if (payload.subtitle?.trim()) {
    bodyChildren.push("subtitle");
    components.push(textNode("subtitle", payload.subtitle.trim()));
  }

  const layout = resolveLayout(payload);
  if (payload.metrics?.length && layout === "chart") {
    bodyChildren.push("chart");
    components.push(chartNode("chart", payload.metrics));
  } else if (payload.metrics?.length && layout === "stats") {
    bodyChildren.push("stats");
    components.push(statRowNode("stats", payload.metrics));
  }

  if (payload.fields?.length) {
    for (let i = 0; i < payload.fields.length; i++) {
      const f = payload.fields[i];
      if (!f) continue;
      const inputId = `input_${i}`;
      bodyChildren.push(inputId);
      components.push({
        id: inputId,
        component: {
          TextField: {
            label: { literalString: f.label },
            ...(f.placeholder
              ? { placeholder: { literalString: f.placeholder } }
              : {}),
          },
        },
      });
    }
  }

  const btnLabel = payload.buttonLabel?.trim();
  if (btnLabel) {
    bodyChildren.push("action");
    components.push(buttonNode("action", btnLabel));
  }

  const cardBody = components.find((c) => c.id === "card_body");
  if (cardBody) {
    cardBody.component = {
      Column: { children: { explicitList: bodyChildren } },
    };
  }

  return [
    { surfaceUpdate: { surfaceId: SURFACE, components } },
    { beginRendering: { surfaceId: SURFACE, root: "root" } },
  ];
}
