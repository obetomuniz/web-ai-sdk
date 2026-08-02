/**
 * Kit-side tool registry. Doubles as the bridge to `@web-ai-sdk/webmcp`:
 * an app can register a tool once with `registerAgentTool(...)` and the
 * registry will optionally also surface it to external agents through
 * WebMCP (`document.modelContext`).
 *
 * `@web-ai-sdk/webmcp` exposes native discovery through `getTools()` and the
 * `useWebMCP()` return value. This registry remains the source of executable
 * `AgentTool` instances for the playground's in-page planner; WebMCP discovery
 * returns browser-facing metadata, not the planner's application callbacks.
 */

import {
  isAvailable as isWebMCPAvailable,
  registerTool as registerWebMCPTool,
  type Tool as WebMCPTool,
} from "@web-ai-sdk/webmcp";
import type { AgentTool, AgentToolContext } from "../types.js";

interface RegistryEntry {
  tool: AgentTool;
  /** Cleanup for the parallel WebMCP registration, if any. */
  webmcpCleanup?: () => void;
}

export interface RegisterToolOptions {
  /**
   * Also expose the tool via `@web-ai-sdk/webmcp` so external agents
   * (Cursor, Claude, the Chrome agent) can discover and invoke it.
   * Default `false`; turn on per-tool when the operation is safe to call
   * cross-origin.
   */
  exposeToWebMCP?: boolean;
}

export class ToolRegistry {
  private entries = new Map<string, RegistryEntry>();
  private listeners = new Set<() => void>();

  list(): readonly AgentTool[] {
    return Array.from(this.entries.values(), (e) => e.tool);
  }

  get(name: string): AgentTool | undefined {
    return this.entries.get(name)?.tool;
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  register(tool: AgentTool, options: RegisterToolOptions = {}): () => void {
    const existing = this.entries.get(tool.name);
    if (existing) {
      existing.webmcpCleanup?.();
    }

    const webmcpCleanup = options.exposeToWebMCP
      ? maybeRegisterWebMCP(tool)
      : undefined;

    this.entries.set(tool.name, { tool, webmcpCleanup });
    this.emit();

    return () => {
      const entry = this.entries.get(tool.name);
      if (!entry || entry.tool !== tool) return;
      entry.webmcpCleanup?.();
      this.entries.delete(tool.name);
      this.emit();
    };
  }

  registerMany(
    tools: readonly AgentTool[],
    options: RegisterToolOptions = {},
  ): () => void {
    const cleanups = tools.map((t) => this.register(t, options));
    return () => {
      cleanups.forEach((cleanup) => {
        cleanup();
      });
    };
  }

  clear(): void {
    for (const entry of this.entries.values()) entry.webmcpCleanup?.();
    this.entries.clear();
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

/**
 * Wraps an `AgentTool` into the `Tool` shape `@web-ai-sdk/webmcp`
 * expects. External agents get the same `inputSchema` the in-page agent
 * sees, but they call through a synthetic AbortSignal and a synthetic
 * `callId` since WebMCP doesn't propagate a parent run context.
 */
function maybeRegisterWebMCP(tool: AgentTool): (() => void) | undefined {
  if (!isWebMCPAvailable()) return undefined;

  const wrapped: WebMCPTool<unknown, unknown> = {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    readOnly: tool.readOnly,
    destructive: tool.destructive,
    execute: async (input) => {
      // External agents (Cursor, Claude, Chrome) call through WebMCP
      // without an associated agent run; there's no event stream to
      // route progress to, so `emit` is a no-op for these calls.
      const ctx: AgentToolContext = {
        signal: new AbortController().signal,
        callId: `webmcp:${cryptoRandomId()}`,
        step: -1,
        emit: () => {
          /* no-op: no parent stream to route to */
        },
      };
      return tool.execute(input ?? {}, ctx);
    },
  };
  return registerWebMCPTool(wrapped);
}

function cryptoRandomId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Default process-wide registry. Most apps mount tools here from a single
 * boot location (e.g. a React effect) and then pass `registry.list()` to
 * `createAgent({ tools: registry.list() })`.
 */
export const sharedToolRegistry = new ToolRegistry();
