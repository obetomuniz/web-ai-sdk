import type { A2uiPlaygroundPayload } from "./constraint.js";
import { synthesizeA2uiMessages } from "./synthesize.js";
import type { A2uiServerMessage } from "./types.js";

function demo(payload: A2uiPlaygroundPayload): A2uiServerMessage[] {
  return synthesizeA2uiMessages(payload);
}

/** Fixed weekly bar chart - no model call required. */
export const DEMO_WEEKLY_CHART: A2uiServerMessage[] = demo({
  title: "Weekly active users",
  subtitle: "Last 7 days · sample data",
  layout: "chart",
  metrics: [
    { label: "Mon", value: 42 },
    { label: "Tue", value: 58 },
    { label: "Wed", value: 51 },
    { label: "Thu", value: 67 },
    { label: "Fri", value: 73 },
    { label: "Sat", value: 38 },
    { label: "Sun", value: 45 },
  ],
  buttonLabel: "Export CSV",
});

/** Welcome card - static marketing-style surface. */
export const DEMO_WELCOME_CARD: A2uiServerMessage[] = demo({
  title: "Welcome to Playground",
  subtitle: "On-device chats and generative UI, entirely in your browser.",
  buttonLabel: "Get started",
});

/** Compact KPI row - no chart, no form. */
export const DEMO_SYSTEM_STATUS: A2uiServerMessage[] = demo({
  title: "System status",
  subtitle: "All services operational",
  layout: "stats",
  metrics: [
    { label: "Uptime", value: 99.9, unit: "%" },
    { label: "p95 latency", value: 42, unit: "ms" },
    { label: "Error rate", value: 0.3, unit: "%" },
  ],
});

export interface A2uiStaticDemo {
  id: string;
  /** Short chip label in the composer. */
  label: string;
  messages: A2uiServerMessage[];
}

export const A2UI_STATIC_DEMOS: A2uiStaticDemo[] = [
  { id: "chart", label: "Weekly chart", messages: DEMO_WEEKLY_CHART },
  { id: "welcome", label: "Welcome card", messages: DEMO_WELCOME_CARD },
  { id: "status", label: "Status KPIs", messages: DEMO_SYSTEM_STATUS },
];
