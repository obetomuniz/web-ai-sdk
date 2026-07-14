/**
 * Pre-baked agent configurations for the playground. Each preset is a
 * small, focused demonstration of what the agent + Built-in Web AI APIs
 * can do without writing any host code.
 */

import type { A2uiStaticDemo } from "../agent/a2ui/index.js";
import { A2UI_STATIC_DEMOS } from "../agent/a2ui/index.js";
import {
  clipboardReadTool,
  clipboardWriteTool,
  clockNowTool,
  createFetchUrlTool,
  detectLanguageTool,
  summarizeTool,
  translateTool,
} from "../agent/tools/index.js";
import type { AgentTool } from "../agent/types.js";
import type { ToolRendererId } from "./toolRenderers.js";
import type { TranscriptRendererId } from "./transcriptRenderers.js";

export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: AgentTool[];
  examples: string[];
  /** Instant previews (no model). Shown as dashed chips before `examples`. */
  a2uiStaticDemos?: readonly A2uiStaticDemo[];
  /** When false, hides "↻ new examples" (avoids random off-topic prompts). */
  regenerateExamples?: boolean;
  transcriptRendererId?: TranscriptRendererId;
  toolRendererId?: ToolRendererId;
  a2ui?: { enabled: boolean };
}

export type AgentSkill = AgentPreset;

// Generous raw cap so full blog/article HTML is captured before the
// tool extracts clean reading text (the article body often sits past
// the first tens of KB of head / nav / inline CSS).
const fetchUrl = createFetchUrlTool();
const platformTools = [
  fetchUrl,
  clockNowTool,
  clipboardReadTool,
  clipboardWriteTool,
  summarizeTool,
];
const platformPrompt =
  "You are a research and productivity assistant. Default to answering DIRECTLY from your own knowledge with NO tools - especially for requests to write, generate, compose, rewrite, or explain something. When the user asks to summarize quoted or pasted text (e.g. after \"Summarize:\"), call `summarize_text` with that exact text - do not paraphrase in prose instead. Reach for other tools only when the task genuinely needs external data you don't have. Use `fetch_url` ONLY when the user actually includes a URL (or explicitly asks you to look something up online), and only ever fetch a URL the user really provided - NEVER invent, guess, or assume a URL. When the user does provide a URL, you MUST call `fetch_url` first (you don't know a page's contents without fetching it); if that fetch fails (often CORS), say so explicitly and never fabricate the page contents. Fetch is read-only and capped to 32 KB; clipboard tools require user permission.";

export const PRESETS: [AgentPreset, ...AgentPreset[]] = [
  {
    id: "a2ui",
    name: "Generative UI (A2UI)",
    description:
      "UI turns use a constrained JSON payload synthesized into A2UI v0.8 on the client. Transport is AgentEvent, not AG-UI.",
    systemPrompt:
      "You build small, helpful UIs in the browser. For cards, charts, or dashboards output one JSON object (title, subtitle, layout, metrics, optional buttonLabel). Prefer charts and KPI tiles over forms. For current time in any city, call clock_now with the right IANA timeZone - never guess. Use plain markdown only for other simple Q&A with no UI.",
    tools: [clockNowTool],
    a2ui: { enabled: true },
    a2uiStaticDemos: A2UI_STATIC_DEMOS,
    examples: [
      "Show a 7-day bar chart titled Weekly signups with sample numbers.",
      "What time is it in Tokyo? (plain text only, no UI)",
    ],
  },
  {
    id: "minimal",
    name: "Minimal",
    description:
      "Bare agent with no tools. Useful to verify the planner loop and structured-output dispatch are healthy on this device.",
    systemPrompt:
      "You are a friendly, terse assistant. Answer the user directly in markdown.",
    tools: [],
    examples: ["Explain what React is in 3 bullet points."],
  },
  {
    id: "web-ai-suite",
    name: "Built-in Web AI suite",
    description:
      "Exposes every Built-in Web AI API the SDK or browser surfaces today: Summarizer (via SDK), Translator, Language Detector. The planner composes them.",
    systemPrompt:
      "You orchestrate the browser's Built-in Web AI APIs. Prefer specialized tools (summarizer, translator, language detector) over solving everything in prose.",
    tools: [summarizeTool, translateTool, detectLanguageTool, clockNowTool],
    examples: [
      'Summarize: "WebMCP exposes browser-page tools to AI agents via navigator.modelContext, mirroring the Model Context Protocol pattern for the web."',
      "What language is 'Eu vou ao mercado amanhã' in? Translate it to English.",
      "It's almost lunchtime. What's the current time?",
    ],
  },
  {
    id: "platform",
    name: "Platform reach",
    description:
      "Adds general-purpose web platform tools: HTTP fetch (JSON parsed, HTML reduced to clean article text), clock, and clipboard read/write.",
    systemPrompt: platformPrompt,
    tools: platformTools,
    examples: [
      "Fetch https://api.github.com/repos/obetomuniz/web-ai-sdk and tell me how many stars it has.",
      "What time is it in Tokyo right now?",
      'Summarize: "WebMCP exposes browser-page tools to AI agents via navigator.modelContext, mirroring the Model Context Protocol pattern for the web."',
      "Summarize https://betomuniz.com/blog/who-owns-the-surface and https://betomuniz.com/blog/the-quiet-ai-war-inside-your-browser",
    ],
  },
  {
    id: "kitchen-sink",
    name: "Kitchen sink",
    description:
      "Everything the playground knows about. Useful for exploring how the planner picks tools when many are available.",
    systemPrompt:
      "You are a research and productivity assistant running on the user's device. Use the most specialized tool for each subtask, and only when it's actually needed - for tasks you can do from your own knowledge (writing, explaining, summarizing pasted text), answer directly with no tools. Use `fetch_url` ONLY when the user actually includes a URL, and only ever fetch a URL the user really provided - NEVER invent, guess, or assume a URL. When the user does provide a URL, you MUST call `fetch_url` first to get the real contents - never invent or guess what a page contains, and never summarize a URL without fetching it. If a fetch fails (often CORS), say so explicitly. Stop as soon as you have the answer.",
    tools: [
      summarizeTool,
      translateTool,
      detectLanguageTool,
      clockNowTool,
      fetchUrl,
      clipboardReadTool,
      clipboardWriteTool,
    ],
    examples: [
      "Detect the language of 'こんにちは', then translate it to English and Portuguese.",
      "Fetch the README of https://api.github.com/repos/obetomuniz/web-ai-sdk/readme, base64-decode it, and give me a 3-bullet summary.",
    ],
  },
];
