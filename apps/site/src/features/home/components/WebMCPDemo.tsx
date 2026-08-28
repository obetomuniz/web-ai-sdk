import {
  ask,
  isAvailable as isPromptAvailable,
  PromptUnavailableError,
  prepareLanguageModel,
} from "@web-ai-sdk/prompt";
import {
  executeTool,
  getTools,
  isAvailable as isWebMcpAvailable,
  type StandardSchemaV1,
} from "@web-ai-sdk/webmcp";
import { useWebMCP } from "@web-ai-sdk/webmcp/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  useCapabilityLease,
  useDemoIntent,
} from "../../../shared/demoLifecycle.js";
import {
  btnSm,
  btnSmGhost,
  card,
  cardBody,
  cardDotLive,
  cardDotOk,
  cardHead,
  cardHeadTitle,
  caret,
  chip,
  chipActive,
  chipRow,
  chipRowEnd,
  demoControls,
  fieldGroup,
  fieldLegend,
  fieldset,
  label,
  outputBox,
  textarea,
  toolList,
  toolToggle,
  toolToggleTrack,
} from "../../../shared/ui.js";
import {
  type DemoIntentProps,
  DownloadDonut,
  StatusBar,
  UnavailableNotice,
  useDownloadMonitor,
  useStreamStats,
} from "./shared.js";

interface ToolSpec {
  id: string;
  name: string;
  title: string;
  desc: string;
  on: boolean;
  match: RegExp;
  readOnly?: boolean;
  destructive?: boolean;
  input?: StandardSchemaV1;
  inputSchema?: object;
  execute(input: unknown): Promise<unknown>;
}

const AddToCartInput = z.strictObject({
  sku: z.string().min(1).describe("The product SKU to add"),
  quantity: z.number().int().min(1).describe("Units to add").optional(),
});

const TOOL_SPECS: readonly ToolSpec[] = [
  {
    id: "add_to_cart",
    name: "add_to_cart",
    title: "Add to cart",
    desc: "Add a SKU to the user's cart",
    on: true,
    match: /\bcart\b|\badd\b|MX-\d+/i,
    input: AddToCartInput,
    inputSchema: z.toJSONSchema(AddToCartInput, {
      io: "input",
      target: "draft-2020-12",
    }),
    execute: async (input: z.output<typeof AddToCartInput>) => ({
      ok: true,
      ...input,
    }),
  },
  {
    id: "search_orders",
    name: "search_orders",
    title: "Search orders",
    desc: "Search past orders by date or item",
    on: true,
    match: /\border|\btuesday|\bpurchase/i,
    readOnly: true,
    execute: async () => ({ ok: true, results: 3 }),
  },
  {
    id: "open_settings",
    name: "open_settings",
    title: "Open settings",
    desc: "List the agent's registered tools and their state",
    on: false,
    match: /\bsetting|\bnotification|\bpreference|\btool|\bregister/i,
    readOnly: true,
    // Placeholder; overridden inside the component so it can read the
    // current registration state from React.
    execute: async () => ({ ok: true }),
  },
  {
    id: "refund",
    name: "refund",
    title: "Issue a refund",
    desc: "Issue a refund (requires confirmation)",
    on: false,
    match: /\brefund|\breturn\b/i,
    destructive: true,
    execute: async () => ({ ok: true, refundId: "rf_demo" }),
  },
];

const MCP_PROMPTS = [
  'Add 2 units of "MX-200" to my cart.',
  "Find my order from last Tuesday.",
  "Open my notification settings.",
] as const;

const ROUTER_SYSTEM_PROMPT =
  "You are a tool-routing agent. Pick one registered tool for the user " +
  "intent, or set tool to null when no registered tool fits; don't force " +
  "a call.";

// JSON Schema passed as `responseConstraint`, so the model emits this shape
// directly and the demo parses it without scraping.
const ROUTE_CONSTRAINT = {
  type: "object",
  additionalProperties: false,
  properties: {
    tool: { type: ["string", "null"] },
    args: { type: "object" },
    reason: { type: "string" },
  },
  required: ["tool", "reason"],
} as const;

interface RoutePlan {
  tool?: string | null;
  args?: Record<string, unknown>;
  reason?: string;
}

/** Validate LM-chosen args against the tool's registered input schema. */
const validateArgs = async (
  spec: ToolSpec,
  args: Record<string, unknown>,
): Promise<
  { ok: true; args: Record<string, unknown> } | { ok: false; message: string }
> => {
  if (!spec.input) return { ok: true, args };
  const result = await spec.input["~standard"].validate(args);
  if (result.issues) {
    return {
      ok: false,
      message: result.issues.map((issue) => issue.message).join("; "),
    };
  }
  return { ok: true, args: result.value as Record<string, unknown> };
};

type TraceEvent =
  | { kind: "step"; text: string }
  | { kind: "warn"; text: string }
  | { kind: "err"; text: string }
  | { kind: "result"; text: string }
  | { kind: "call"; tool: string; args: unknown; reason: string };

export const WebMCPDemo = ({ intent: tabIntent }: DemoIntentProps) => {
  const [enabledIds, setEnabledIds] = useState<Set<string>>(
    () => new Set(TOOL_SPECS.filter((t) => t.on).map((t) => t.id)),
  );
  const [prompt, setPrompt] = useState<string>(MCP_PROMPTS[0]);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const { stats, start, update, finish } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const { intent, markInteracted } = useDemoIntent(tabIntent);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAvailable(isWebMcpAvailable());
  }, []);

  // Abort in-flight routing when the demo unmounts (for example tab change).
  useEffect(() => () => abortRef.current?.abort(), []);

  // The router runs on the Prompt API, so intent prepares that base session
  // with the exact routing configuration the run reuses.
  const createLease = useCallback(
    () =>
      prepareLanguageModel({
        systemPrompt: ROUTER_SYSTEM_PROMPT,
        samplingMode: "most-predictable",
        monitor,
      }),
    [monitor],
  );
  useCapabilityLease(
    intent && available === true && isPromptAvailable(),
    createLease,
  );

  // Build the live definitions from the toggle state. `useWebMCP` re-registers only
  // when discoverable metadata changes and keeps execute callbacks current,
  // so `open_settings` can read this render's state directly.
  const tools = useMemo(() => {
    return TOOL_SPECS.filter((t) => enabledIds.has(t.id)).map((spec) => ({
      name: spec.name,
      title: spec.title,
      description: spec.desc,
      ...(spec.input ? { input: spec.input } : {}),
      ...(spec.inputSchema ? { inputSchema: spec.inputSchema } : {}),
      ...(spec.readOnly ? { readOnly: true } : {}),
      ...(spec.destructive ? { destructive: true } : {}),
      execute:
        spec.id === "open_settings"
          ? async () => {
              const registered = await getTools();
              return {
                ok: true,
                registered: registered
                  .filter((tool) =>
                    TOOL_SPECS.some(
                      (candidate) => candidate.name === tool.name,
                    ),
                  )
                  .map(({ name, title, description }) => ({
                    name,
                    title,
                    description,
                  })),
              };
            }
          : spec.execute,
    }));
  }, [enabledIds]);
  const {
    tools: discoveredTools,
    status: discoveryStatus,
    refresh: refreshDiscoveredTools,
  } = useWebMCP(tools);

  const toggle = (id: string) =>
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const stop = () => abortRef.current?.abort();

  const run = async () => {
    if (running) return;
    // Defensive bail: on browsers without `document.modelContext` (or the
    // legacy `navigator.modelContext`), the demo's tool execute closures are
    // pure JS and would still "succeed" if invoked directly, which makes the
    // trace pretend WebMCP worked. Refuse to run when the API is missing so
    // the unavailable banner is the only thing the visitor sees. The button
    // below is also disabled in the same condition; this guard is the second
    // line of defence.
    if (available === false) return;
    setRunning(true);
    setTrace([]);
    start();
    const ac = new AbortController();
    abortRef.current = ac;

    const throwIfStopped = () => {
      if (ac.signal.aborted) throw new DOMException("Aborted", "AbortError");
    };

    const push = async (ev: TraceEvent, delay = 240) => {
      throwIfStopped();
      setTrace((t) => [...t, ev]);
      update("x".repeat(JSON.stringify(ev).length));
      await new Promise((r) => setTimeout(r, delay));
      throwIfStopped();
    };

    try {
      const discovered = await refreshDiscoveredTools();
      const discoveredDemoTools = discovered.filter((tool) =>
        TOOL_SPECS.some((candidate) => candidate.name === tool.name),
      );
      const discoveredNames = new Set(
        discoveredDemoTools.map(({ name }) => name),
      );
      const discoveredCount = discovered.length;
      const demoToolCount = discoveredDemoTools.length;
      const enabledSpecs = TOOL_SPECS.filter((tool) =>
        discoveredNames.has(tool.name),
      );
      await push(
        {
          kind: "step",
          text: `getTools() → ${discoveredCount} tool${discoveredCount === 1 ? "" : "s"} (${demoToolCount} in this demo)`,
        },
        200,
      );

      // Try a real on-device agent: ask the Prompt API which tool to call,
      // constrained to the routing schema so the reply parses directly.
      // Fall back to keyword matching when Prompt isn't available.
      // Tracks three outcomes: a candidate (use this tool), a refusal
      // (LM said no tool matches), or a fallback (Prompt API not available;
      // try keyword matching).
      let candidate: ToolSpec | null = null;
      let chosenArgs: Record<string, unknown> = {};
      let chosenReason = "";
      let usedRealAgent = false;
      let agentRefused: { reason: string } | null = null;

      if (isPromptAvailable() && enabledSpecs.length > 0) {
        await push(
          {
            kind: "step",
            text: "Prompt API → picking a tool with the on-device LM…",
          },
          260,
        );
        const toolBlock = enabledSpecs
          .map((tool) => {
            const schema = tool.inputSchema
              ? JSON.stringify(tool.inputSchema)
              : "no input schema";
            return `- ${tool.name}: ${tool.desc}\n  input schema: ${schema}`;
          })
          .join("\n");
        const agentInput = `Registered tools:
${toolBlock}

User said: "${prompt}"

Choose one of the registered tool names if the user intent maps to it, and fill "args" from its input schema. If no registered tool matches, set "tool" to null and explain briefly in "reason".`;
        try {
          const result = await ask({
            input: agentInput,
            systemPrompt: ROUTER_SYSTEM_PROMPT,
            samplingMode: "most-predictable",
            responseConstraint: ROUTE_CONSTRAINT,
            monitor,
            signal: ac.signal,
          });
          // The response constraint guarantees the JSON shape; parse the
          // output directly instead of scraping it with a regex.
          const parsed = JSON.parse(result.output ?? "null") as RoutePlan;
          const reason = parsed?.reason ?? "(no reason given)";
          if (parsed?.tool === null || parsed?.tool === undefined) {
            agentRefused = { reason };
            usedRealAgent = true;
          } else {
            const found = enabledSpecs.find((t) => t.name === parsed.tool);
            if (!found) {
              // LM named a tool that isn't registered; treat as refusal
              // rather than silently calling something else.
              agentRefused = {
                reason: `LM picked "${parsed.tool}" which isn't registered. ${reason}`,
              };
              usedRealAgent = true;
            } else {
              const checked = await validateArgs(found, parsed.args ?? {});
              if (!checked.ok) {
                agentRefused = {
                  reason: `LM args for "${found.name}" failed schema validation: ${checked.message}`,
                };
                usedRealAgent = true;
              } else {
                candidate = found;
                chosenArgs = checked.args;
                chosenReason = reason;
                usedRealAgent = true;
              }
            }
          }
        } catch (err) {
          throwIfStopped();
          if (!(err instanceof PromptUnavailableError)) {
            await push(
              {
                kind: "warn",
                text: `Prompt API error: ${(err as Error)?.message ?? "unknown"}; falling back to keyword match.`,
              },
              200,
            );
          }
        }
      }

      if (agentRefused) {
        await push({
          kind: "warn",
          text: `Refused: ${agentRefused.reason}`,
        });
        finish("refused");
        return;
      }

      if (!usedRealAgent) {
        await push(
          {
            kind: "step",
            text: "Falling back to keyword match (enable Prompt API for a real agent).",
          },
          200,
        );
        const matched = enabledSpecs.find((t) => t.match.test(prompt));
        if (!matched) {
          await push({
            kind: "warn",
            text: "Refused: no enabled tool matched the user intent.",
          });
          finish("refused");
          return;
        }
        candidate = matched;
        chosenArgs =
          matched.id === "add_to_cart"
            ? { sku: "MX-200", quantity: 2 }
            : matched.id === "search_orders"
              ? { since: "last-tuesday" }
              : matched.id === "open_settings"
                ? { pane: "notifications" }
                : {};
        chosenReason = `User intent mentions "${(prompt.match(matched.match)?.[0] ?? "").trim()}"; best match is ${matched.name}.`;
      }

      if (!candidate) {
        await push({
          kind: "warn",
          text: "Refused: no candidate tool.",
        });
        finish("refused");
        return;
      }

      await push(
        {
          kind: "call",
          tool: candidate.name,
          args: chosenArgs,
          reason: chosenReason,
        },
        280,
      );

      let resultText = "null";
      const registeredTool = discoveredDemoTools.find(
        (tool) => tool.name === candidate.name,
      );
      if (!registeredTool) {
        resultText = `error: ${candidate.name} is no longer registered`;
      } else {
        try {
          const raw = await executeTool(registeredTool, chosenArgs);
          resultText = raw ?? "navigation triggered";
        } catch (err) {
          resultText = `error: ${(err as Error)?.message ?? "unknown"}`;
        }
      }
      throwIfStopped();
      await push(
        { kind: "result", text: `↳ ${candidate.name}(...) → ${resultText}` },
        200,
      );
      finish("done");
    } catch (err) {
      if (ac.signal.aborted || (err as Error)?.name === "AbortError") {
        finish("stopped");
      } else {
        setTrace((t) => [
          ...t,
          {
            kind: "err",
            text: `Run failed: ${(err as Error)?.message ?? "unknown"}`,
          },
        ]);
        finish("error");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const registeredCount = discoveredTools.filter((tool) =>
    TOOL_SPECS.some((candidate) => candidate.name === tool.name),
  ).length;

  return (
    <div
      className={card}
      onFocusCapture={markInteracted}
      onPointerDownCapture={markInteracted}
    >
      <div className={cardHead}>
        <span className={cardHeadTitle}>
          <span className={running ? cardDotLive : cardDotOk} />
          registerTool() · agentic
        </span>
        <span className="inline-flex items-center gap-2">
          <DownloadDonut progress={progress} />
          {discoveryStatus === "loading" ? "…" : registeredCount} demo tool
          {registeredCount === 1 ? "" : "s"} registered
        </span>
      </div>
      <div className={cardBody}>
        {available === false && <UnavailableNotice api="WebMCP" />}
        <p className="mb-4 text-[11px] leading-5 text-fg-4">
          This demo detects <code>document.modelContext</code> and routes tools
          in this page. It cannot show whether an external agent will discover
          or invoke a tool.
        </p>
        <fieldset className={fieldset}>
          <legend className={fieldLegend}>demo tools</legend>
          <ul className={toolList}>
            {TOOL_SPECS.map((t) => {
              const on = enabledIds.has(t.id);
              return (
                <li
                  key={t.id}
                  className="group/tool bg-transparent"
                  data-on={on ? "true" : "false"}
                >
                  <button
                    type="button"
                    className={toolToggle}
                    onClick={() => toggle(t.id)}
                    aria-pressed={on}
                    disabled={available === false}
                  >
                    <span className={toolToggleTrack} aria-hidden="true" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-fg">
                        {t.name}
                        <span className="text-fg-4">()</span>
                      </span>
                      <span className="text-[11px] text-fg-4 max-[640px]:text-[10.5px]">
                        {t.desc}
                      </span>
                    </span>
                    <span className="text-[11px] text-fg-4">
                      {on ? "exposed" : "hidden"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
        <div className={fieldGroup}>
          <label className={label} htmlFor="webmcp-demo-prompt">
            user intent
          </label>
          <textarea
            id="webmcp-demo-prompt"
            className={`${textarea} min-h-16`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className={demoControls}>
          {!running ? (
            <button
              type="button"
              className={btnSm}
              onClick={run}
              disabled={!available}
            >
              <span>▶</span> Run agent
            </button>
          ) : (
            <button type="button" className={btnSmGhost} onClick={stop}>
              <span>■</span> Stop
            </button>
          )}
          <div className={`${chipRow} ${chipRowEnd}`}>
            {MCP_PROMPTS.map((p, i) => (
              <button
                key={p}
                type="button"
                className={prompt === p ? chipActive : chip}
                onClick={() => setPrompt(p)}
                disabled={available === false}
              >
                {["cart", "order lookup", "settings"][i]}
              </button>
            ))}
          </div>
        </div>
        <div className={`${outputBox} min-h-[120px]`}>
          {trace.length === 0 && !running ? (
            <span className="text-fg-4 italic">
              Agent trace will appear here.
            </span>
          ) : (
            trace.map((ev, i) => {
              if (ev.kind === "call") {
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the trace is an append-only log rendered in order; entries are never reordered or removed, so the index is a stable key
                  <div key={`${ev.tool}-${i}`} className="mb-1.5">
                    <span className="text-accent">→ call</span>{" "}
                    <span>{ev.tool}</span>
                    <span className="text-fg-4">(</span>
                    <span className="text-fg-2">{JSON.stringify(ev.args)}</span>
                    <span className="text-fg-4">)</span>
                    <div className="ml-3.5 text-[11px] text-fg-4">
                      {`// ${ev.reason}`}
                    </div>
                  </div>
                );
              }
              const colorClass =
                ev.kind === "err"
                  ? "text-err"
                  : ev.kind === "warn"
                    ? "text-warn"
                    : ev.kind === "result"
                      ? "text-ok"
                      : "text-fg-3";
              const prefix =
                ev.kind === "err"
                  ? "✗ "
                  : ev.kind === "warn"
                    ? "⚠ "
                    : ev.kind === "result"
                      ? "✓ "
                      : "· ";
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: the trace is an append-only log rendered in order; entries are never reordered or removed, so the index is a stable key
                <div key={`${ev.kind}-${i}`} className={`${colorClass} mb-1`}>
                  {prefix}
                  {ev.text}
                </div>
              );
            })
          )}
          {running && <span className={`${caret} ml-[0.15em]`} />}
        </div>
        <StatusBar stats={stats} label="protocol: WebMCP/0.1" />
      </div>
    </div>
  );
};
