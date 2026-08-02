import {
  ask,
  isAvailable as isPromptAvailable,
  PromptUnavailableError,
} from "@web-ai-sdk/prompt";
import {
  isAvailable as isWebMcpAvailable,
  type StandardSchemaV1,
} from "@web-ai-sdk/webmcp";
import { useWebMCP } from "@web-ai-sdk/webmcp/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  btnSm,
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
  DownloadNotice,
  StatusBar,
  UnavailableNotice,
  useDownloadMonitor,
  useStreamStats,
} from "./shared.js";

interface ToolSpec {
  id: string;
  name: string;
  desc: string;
  on: boolean;
  match: RegExp;
  readOnly?: boolean;
  destructive?: boolean;
  input?: StandardSchemaV1;
  inputSchema?: object;
  execute(input: unknown): Promise<unknown>;
}

const AddToCartInput = z.object({
  sku: z.string().min(1).describe("The product SKU to add"),
  qty: z.number().int().min(1).describe("Units to add").optional(),
});

const TOOL_SPECS: readonly ToolSpec[] = [
  {
    id: "add_to_cart",
    name: "add_to_cart",
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
    desc: "Search past orders by date or item",
    on: true,
    match: /\border|\btuesday|\bpurchase/i,
    readOnly: true,
    execute: async () => ({ ok: true, results: 3 }),
  },
  {
    id: "open_settings",
    name: "open_settings",
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

type TraceEvent =
  | { kind: "step"; text: string }
  | { kind: "warn"; text: string }
  | { kind: "err"; text: string }
  | { kind: "result"; text: string }
  | { kind: "call"; tool: string; args: unknown; reason: string };

interface ToolTestingSurface {
  listTools: () => Array<{ name: string }>;
  executeTool: (name: string, input?: string) => Promise<string>;
}

const getTestingSurface = (): ToolTestingSurface | null => {
  if (typeof navigator === "undefined") return null;
  return (
    (navigator as unknown as { modelContextTesting?: ToolTestingSurface })
      .modelContextTesting ?? null
  );
};

export const WebMCPDemo = () => {
  const [enabledIds, setEnabledIds] = useState<Set<string>>(
    () => new Set(TOOL_SPECS.filter((t) => t.on).map((t) => t.id)),
  );
  const [prompt, setPrompt] = useState<string>(MCP_PROMPTS[0]);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const { stats, start, update, finish } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();

  useEffect(() => {
    setAvailable(isWebMcpAvailable());
  }, []);

  // Keep a live ref to the latest toggle state. The open_settings execute
  // closure below reads from this ref instead of a captured `enabledIds`
  // value, because Chrome's WebMCP processes AbortSignal-driven
  // unregistration asynchronously: a sync re-register fired by useWebMCP's
  // effect cycle can hit a not-yet-propagated abort and the library's
  // microtask retry can silently skip on a second duplicate-name error.
  // When that happens, the OLD execute closure stays registered and would
  // report stale enabled flags. The ref dodges the problem entirely:
  // whichever closure Chrome ends up holding, it always reads the latest
  // state at invocation time.
  const enabledIdsRef = useRef(enabledIds);
  enabledIdsRef.current = enabledIds;

  // Build the live definitions from the toggle state. Stable per enabled set
  // so the hook only re-registers when toggles change.
  // `open_settings` gets a closure that reports the live registration state,
  // turning it into a self-describing tool the agent can introspect.
  const tools = useMemo(() => {
    return TOOL_SPECS.filter((t) => enabledIds.has(t.id)).map((spec) => ({
      name: spec.name,
      description: spec.desc,
      ...(spec.input ? { input: spec.input } : {}),
      ...(spec.inputSchema ? { inputSchema: spec.inputSchema } : {}),
      ...(spec.readOnly ? { readOnly: true } : {}),
      ...(spec.destructive ? { destructive: true } : {}),
      execute:
        spec.id === "open_settings"
          ? async () => ({
              ok: true,
              // Only the actually-registered tools. A disabled tool is not
              // in the model context at all, so listing it here would be
              // inaccurate.
              registered: TOOL_SPECS.filter((t) =>
                enabledIdsRef.current.has(t.id),
              ).map((t) => ({
                name: t.name,
                description: t.desc,
              })),
            })
          : spec.execute,
    }));
  }, [enabledIds]);
  useWebMCP(tools);

  const toggle = (id: string) =>
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

    const push = async (ev: TraceEvent, delay = 240) => {
      setTrace((t) => [...t, ev]);
      update("x".repeat(JSON.stringify(ev).length));
      await new Promise((r) => setTimeout(r, delay));
    };

    const enabledCount = enabledIds.size;
    const enabledSpecs = TOOL_SPECS.filter((t) => enabledIds.has(t.id));
    await push(
      {
        kind: "step",
        text: `document.modelContext.listTools() → ${enabledCount} tool${enabledCount === 1 ? "" : "s"}`,
      },
      200,
    );

    // Try a real on-device agent: ask the Prompt API which tool to call.
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
        .map((t) => `- ${t.name}: ${t.desc}`)
        .join("\n");
      const agentInput = `Registered tools:
${toolBlock}

User said: "${prompt}"

Reply with ONLY valid JSON of the shape {"tool":"name_or_null","args":{},"reason":"one short sentence"}. Choose one of the registered tool names if the user intent maps to it. If no registered tool matches, set "tool" to null and explain briefly in "reason". No markdown, no backticks.`;
      try {
        const result = await ask({
          input: agentInput,
          systemPrompt:
            "You are a tool-routing agent. Reply with valid JSON only. " +
            "Set tool to null when no registered tool fits the user intent; " +
            "don't force a call.",
          samplingMode: "most-predictable",
          monitor,
        });
        const raw = result.output ?? "";
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]) as {
            tool?: string | null;
            args?: Record<string, unknown>;
            reason?: string;
          };
          const reason = parsed.reason ?? "(no reason given)";
          if (parsed.tool === null || parsed.tool === undefined) {
            agentRefused = { reason };
            usedRealAgent = true;
          } else {
            const found = enabledSpecs.find((t) => t.name === parsed.tool);
            if (found) {
              candidate = found;
              chosenArgs = parsed.args ?? {};
              chosenReason = reason;
              usedRealAgent = true;
            } else {
              // LM named a tool that isn't registered; treat as refusal
              // rather than silently calling something else.
              agentRefused = {
                reason: `LM picked "${parsed.tool}" which isn't registered. ${reason}`,
              };
              usedRealAgent = true;
            }
          }
        }
      } catch (err) {
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
      setRunning(false);
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
        setRunning(false);
        return;
      }
      candidate = matched;
      chosenArgs =
        matched.id === "add_to_cart"
          ? { sku: "MX-200", qty: 2 }
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
      setRunning(false);
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

    // Invoke the tool via the testing surface when available, otherwise
    // synthesize the result locally so the trace still resolves.
    let resultText = "{ ok: true }";
    const testing = getTestingSurface();
    if (testing) {
      try {
        const raw = await testing.executeTool(
          candidate.name,
          JSON.stringify(chosenArgs),
        );
        resultText = typeof raw === "string" ? raw : JSON.stringify(raw);
      } catch (err) {
        resultText = `error: ${(err as Error)?.message ?? "unknown"}`;
      }
    } else {
      // No testing surface; fall back to invoking the *live* registered
      // execute so open_settings still reports the real registration state.
      const live = tools.find((t) => t.name === candidate.name);
      const exec = live?.execute ?? candidate.execute;
      resultText = JSON.stringify(await exec(chosenArgs));
    }
    await push(
      { kind: "result", text: `↳ ${candidate.name}(...) → ${resultText}` },
      200,
    );
    finish("done");
    setRunning(false);
  };

  const registeredCount = enabledIds.size;

  return (
    <div className={card}>
      <div className={cardHead}>
        <span className={cardHeadTitle}>
          <span className={running ? cardDotLive : cardDotOk} />
          registerTool() · agentic
        </span>
        <span>
          {registeredCount} tool{registeredCount === 1 ? "" : "s"} registered
        </span>
      </div>
      <div className={cardBody}>
        {available === false && (
          <UnavailableNotice api="WebMCP" flagSearch="WebMCP" />
        )}
        <DownloadNotice progress={progress} />
        <fieldset className={fieldset}>
          <legend className={fieldLegend}>registered tools</legend>
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
          <button
            type="button"
            className={btnSm}
            onClick={run}
            disabled={running || !available}
          >
            <span>{running ? "…" : "▶"}</span> Run agent
          </button>
          <div className={`${chipRow} ${chipRowEnd}`}>
            {MCP_PROMPTS.map((p, i) => (
              <button
                key={p}
                type="button"
                className={prompt === p ? chipActive : chip}
                onClick={() => setPrompt(p)}
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
