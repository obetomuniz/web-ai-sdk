/**
 * Small JSON Schema for on-device `responseConstraint` on UI turns.
 * The loop converts this object into valid A2UI v0.8 messages in code.
 */
export const A2UI_PLAYGROUND_CONSTRAINT = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    buttonLabel: { type: "string" },
    layout: { type: "string", enum: ["chart", "stats", "card"] },
    metrics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "number" },
          unit: { type: "string" },
        },
        required: ["label", "value"],
        additionalProperties: false,
      },
    },
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          placeholder: { type: "string" },
        },
        required: ["label"],
        additionalProperties: false,
      },
    },
  },
  required: ["title"],
  additionalProperties: false,
} as const;

export type A2uiPlaygroundLayout = "chart" | "stats" | "card";

export interface A2uiMetric {
  label: string;
  value: number;
  unit?: string;
}

export interface A2uiPlaygroundPayload {
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  layout?: A2uiPlaygroundLayout;
  metrics?: A2uiMetric[];
  fields?: Array<{ label: string; placeholder?: string }>;
}

export function parsePlaygroundPayload(
  text: string,
): A2uiPlaygroundPayload | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence?.[1]?.trim() ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (typeof o.title !== "string" || !o.title.trim()) return null;
    const layout =
      o.layout === "chart" || o.layout === "stats" || o.layout === "card"
        ? o.layout
        : undefined;
    const metrics = Array.isArray(o.metrics)
      ? o.metrics
          .filter(
            (m): m is A2uiMetric =>
              !!m &&
              typeof m === "object" &&
              typeof (m as { label?: unknown }).label === "string" &&
              typeof (m as { value?: unknown }).value === "number",
          )
          .map((m) => ({
            label: String((m as A2uiMetric).label).trim(),
            value: (m as A2uiMetric).value,
            unit:
              typeof (m as { unit?: unknown }).unit === "string"
                ? (m as { unit: string }).unit
                : undefined,
          }))
      : undefined;
    const fields = Array.isArray(o.fields)
      ? o.fields
          .filter(
            (f): f is { label: string; placeholder?: string } =>
              !!f &&
              typeof f === "object" &&
              typeof (f as { label?: unknown }).label === "string",
          )
          .map((f) => ({
            label: f.label,
            placeholder:
              typeof f.placeholder === "string" ? f.placeholder : undefined,
          }))
      : undefined;
    return {
      title: o.title.trim(),
      subtitle: typeof o.subtitle === "string" ? o.subtitle : undefined,
      buttonLabel:
        typeof o.buttonLabel === "string" ? o.buttonLabel : undefined,
      layout,
      metrics: metrics?.length ? metrics : undefined,
      fields: fields?.length ? fields : undefined,
    };
  } catch {
    return null;
  }
}
