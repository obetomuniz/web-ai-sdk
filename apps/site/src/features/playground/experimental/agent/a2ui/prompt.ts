import { A2UI_V0_8_STANDARD_CATALOG } from "./types.js";

/**
 * System-prompt appendix for A2UI on the playground preset.
 */
export function buildA2uiPromptAppendix(
  catalogId = A2UI_V0_8_STANDARD_CATALOG,
): string {
  return [
    "## Generative UI (A2UI playground)",
    "",
    "When the user asks for a **card, chart, dashboard, or layout**, respond with a **single JSON object** (no markdown, no fences, no prose):",
    "",
    "```json",
    '{ "title": "Weekly usage", "subtitle": "Last 7 days", "layout": "chart", "metrics": [{ "label": "Mon", "value": 42 }], "buttonLabel": "Export" }',
    "```",
    "",
    "- `title` (required): heading text",
    "- `subtitle` (optional): secondary line",
    '- `layout` (optional): `"chart"` (bar chart), `"stats"` (KPI tiles), or `"card"` (text only)',
    "- `metrics` (optional): `{ label, value, unit? }[]` for charts or KPIs",
    "- `buttonLabel` (optional): primary button; omit if no action",
    "- Avoid `fields` unless the user explicitly asks for a form",
    "",
    "For **plain Q&A** (time, facts, explanations) with no UI, answer in normal markdown only.",
    "",
    `Catalog reference: \`${catalogId}\` (the client converts your JSON into A2UI).`,
  ].join("\n");
}
