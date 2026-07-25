/**
 * Pre-baked agent configurations for the playground. Each preset is a
 * small, focused demonstration of what the agent + Built-in Web AI APIs
 * can do without writing any host code.
 */

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

export interface AgentMode {
  id: string;
  name: string;
  accent: "info" | "ok" | "warn" | "violet";
  description: string;
  systemPrompt: string;
  tools: AgentTool[];
  examples: string[];
  transcriptRendererId?: TranscriptRendererId;
  toolRendererId?: ToolRendererId;
}

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
  'You are a research and productivity assistant. Default to answering DIRECTLY from your own knowledge with NO tools - especially for requests to write, generate, compose, rewrite, or explain something. When the user asks to summarize quoted or pasted text (e.g. after "Summarize:"), call `summarize_text` with that exact text - do not paraphrase in prose instead. Reach for other tools only when the task genuinely needs external data you don\'t have. Use `fetch_url` when the user includes a URL, explicitly asks you to look something up online, or makes an unambiguous follow-up about another resource relative to a URL already fetched in this conversation. A contextual URL must be derived from an explicit identifier and a known prior route; if it is ambiguous, ask for the URL instead. Never state fresh external facts without a successful tool result in the current turn. If a fetch fails (often CORS), say so explicitly and never fabricate the page contents. Fetch is read-only and capped to 32 KB; clipboard tools require user permission.';

export const MODES: [AgentMode, ...AgentMode[]] = [
  {
    id: "minimal",
    name: "Minimal",
    accent: "info",
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
    accent: "ok",
    description:
      "Composes specialized SDK tools for Summarizer, Translator, and Language Detector in one agent flow.",
    systemPrompt:
      "You orchestrate the browser's Built-in Web AI APIs and must demonstrate the specialized tools instead of silently replacing them with model knowledge. For translation requests, ALWAYS call `translate_text` for every requested target language; never translate in prose yourself. When the source language is not explicit, call `detect_language` first, then use its top language code as `sourceLanguage` for the translation call(s). After detection, multiple target translations may run in parallel. For requests to summarize supplied text, ALWAYS call `summarize_text`. Report an unavailable/error tool result honestly instead of fabricating the operation.",
    tools: [summarizeTool, translateTool, detectLanguageTool, clockNowTool],
    examples: [
      'Summarize: "WebMCP exposes browser-page tools to AI agents via navigator.modelContext, mirroring the Model Context Protocol pattern for the web."',
      "Detect the language of 'こんにちは', then translate it to English and Portuguese.",
      "It's almost lunchtime. What's the current time?",
    ],
  },
  {
    id: "platform",
    name: "Platform reach",
    accent: "warn",
    description:
      "Adds general-purpose web platform tools: HTTP fetch (JSON parsed, HTML reduced to clean article text), clock, and clipboard read/write.",
    systemPrompt: platformPrompt,
    tools: platformTools,
    examples: [
      "Fetch https://api.github.com/repos/obetomuniz/web-ai-sdk and tell me how many stars it has.",
      "Summarize https://betomuniz.com/blog/who-owns-the-surface and https://betomuniz.com/blog/the-quiet-ai-war-inside-your-browser",
      "What time is it in Tokyo right now?",
      'Summarize: "WebMCP exposes browser-page tools to AI agents via navigator.modelContext, mirroring the Model Context Protocol pattern for the web."',
    ],
  },
  {
    id: "kitchen-sink",
    name: "Kitchen sink",
    accent: "violet",
    description:
      "Everything the playground knows about. Useful for exploring how the planner picks tools when many are available.",
    systemPrompt:
      "You are a research and productivity assistant running on the user's device. Use the most specialized tool for each subtask, and only when it's actually needed - for tasks you can do from your own knowledge (writing, explaining, summarizing pasted text), answer directly with no tools. Use `fetch_url` when the user includes a URL, explicitly requests an online lookup, or makes an unambiguous follow-up about another resource relative to a URL already fetched in this conversation. Derive a contextual URL only from an explicit identifier and a known prior route; if it is ambiguous, ask for the URL. Never state fresh external facts without a successful tool result in the current turn, and never summarize a URL without fetching it. If a fetch fails (often CORS), say so explicitly. Stop as soon as you have the answer.",
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
