/** User-activated checks against real SDK exports. No persisted conversation data. */
import {
  checkAvailability as checkPrompt,
  createSession,
  isAvailable as promptExposed,
} from "@web-ai-sdk/prompt";
import {
  executeTool,
  getTools,
  registerTool,
  type Tool,
  isAvailable as webmcpExposed,
} from "@web-ai-sdk/webmcp";
import {
  detectLanguageTool,
  proofreadTool,
  rewriteTool,
  summarizeTool,
  translateTool,
  writeTool,
} from "./experimental/agent/tools/index.js";
import { withSignal } from "./experimental/agent/tools/lifecycle.js";
import type { AgentTool } from "./experimental/agent/types.js";
import type { AgentThread } from "./lib/agentThreads.js";
import {
  createPlaygroundWebMCPTools,
  type PlaygroundWebMCPContext,
} from "./lib/usePlaygroundWebMCPTools.js";

export interface SmokeResult {
  name: string;
  status: "pass" | "fail" | "skip";
  detail: unknown;
}
export async function runSmoke(
  report: (result: SmokeResult) => void,
  signal: AbortSignal,
) {
  report({
    name: "environment",
    status: "pass",
    detail: {
      userAgent: navigator.userAgent,
      secureContext: isSecureContext,
      date: new Date().toISOString(),
      executionArity: (
        document as Document & {
          modelContext?: { executeTool?: { length: number } };
        }
      ).modelContext?.executeTool?.length,
      setup:
        "Record exact browser build and flags separately. This page installs no origin-trial token.",
    },
  });
  const parentSignal = signal;
  const check = async (
    name: string,
    run: (signal: AbortSignal) => Promise<unknown>,
  ) => {
    if (parentSignal.aborted) return;
    const deadline = AbortSignal.timeout(45000);
    const signal = AbortSignal.any([parentSignal, deadline]);
    try {
      report({
        name,
        status: "pass",
        detail: await withSignal(run(signal), signal),
      });
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      report({
        name,
        status: e.name.endsWith("UnavailableError") ? "skip" : "fail",
        detail: {
          name: deadline.aborted ? "TimeoutError" : e.name,
          message: deadline.aborted ? "Check exceeded 45 seconds." : e.message,
        },
      });
    }
  };
  await check("Prompt follow-up and repeated digits", async (signal) => {
    if (!promptExposed()) {
      const error = new Error("Prompt API not exposed");
      error.name = "PromptUnavailableError";
      throw error;
    }
    const readiness = await checkPrompt({
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
    if (readiness !== "available") {
      const error = new Error(
        `Prompt readiness: ${readiness ?? "unknown"}. Prepare the model in Playground, then rerun.`,
      );
      error.name = "PromptUnavailableError";
      throw error;
    }
    const session = createSession({
      samplingMode: "predictable",
      language: "en",
    });
    const chunks: string[][] = [];
    try {
      for (const input of [
        "40 + 4",
        "dont add the calculation, just result, ok?",
      ]) {
        const turn: string[] = [];
        chunks.push(turn);
        for await (const chunk of session.sendStreaming(input, { signal }))
          turn.push(chunk);
      }
      if (chunks[1]?.join("").trim() !== "44")
        throw new Error(`Expected 44; received ${JSON.stringify(chunks)}`);
      return { chunks, output: "44" };
    } finally {
      session.destroy();
    }
  });
  const textCases: Array<[AgentTool, Record<string, unknown>]> = [
    [
      writeTool,
      { task: "Draft a one-sentence welcome email.", length: "short" },
    ],
    [rewriteTool, { text: "hey, send me the doc please", tone: "more-formal" }],
    [
      proofreadTool,
      { text: "I seen him yesterday.", expectedInputLanguages: ["en"] },
    ],
    [
      summarizeTool,
      {
        text: "The team meets on Monday. The team reviews the project and agrees on the next task.",
      },
    ],
    [
      translateTool,
      { text: "Hello world", sourceLanguage: "en", targetLanguage: "pt" },
    ],
    [detectLanguageTool, { text: "Olá, como você está?" }],
  ];
  for (const [tool, input] of textCases)
    await check(tool.name, async (signal) => {
      const progress: unknown[] = [];
      const output = await tool.execute(input, {
        signal,
        emit: (data) => {
          progress.push(data);
          if (
            data &&
            typeof data === "object" &&
            (data as { phase?: string }).phase === "readiness"
          ) {
            const state = (data as { state?: string }).state;
            if (state !== "available") {
              const error = new Error(
                `Readiness: ${state}. Prepare the model in Playground, then rerun.`,
              );
              error.name = "SmokeUnavailableError";
              throw error;
            }
          }
        },
        callId: `smoke:${tool.name}`,
        step: 0,
      });
      return { output, progress };
    });
  await check("WebMCP conversation controls and cancellation", (signal) =>
    smokeWebMCP(signal),
  );
}

async function smokeWebMCP(signal: AbortSignal) {
  if (!webmcpExposed()) {
    const error = new Error("WebMCP API not exposed");
    error.name = "WebMCPUnavailableError";
    throw error;
  }
  const isolated: AgentThread = {
    id: `smoke-${crypto.randomUUID()}`,
    name: "Disposable smoke conversation",
    modeId: "minimal",
    turns: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const threads = [isolated];
  const counts: Record<string, number> = {};
  let nativeSignal = false;
  let onSendStarted: (() => void) | undefined;
  const context: PlaygroundWebMCPContext = {
    threads,
    activeThread: isolated,
    busy: false,
    newSession() {},
    pushActivity() {},
    send: async (_text, options) => {
      nativeSignal = Boolean(options?.signal);
      onSendStarted?.();
      if (!options?.signal)
        throw new Error("Host omitted native cancellation signal");
      await withSignal(new Promise<void>(() => {}), options.signal);
      return true;
    },
    ops: {
      create() {
        throw new Error("Smoke uses only its isolated conversation");
      },
      select() {},
      rename() {},
      touch() {},
      appendTurn() {},
      setMode() {},
      remove(id) {
        const index = threads.findIndex((thread) => thread.id === id);
        if (index >= 0) threads.splice(index, 1);
      },
    },
  };
  const definitions = createPlaygroundWebMCPTools(context);
  // The factory already validates its heterogeneous inputs. Preserve each schema and count its callback.
  const wrapped: Tool[] = definitions.map((definition) => ({
    ...definition,
    execute(input, options) {
      counts[definition.name] = (counts[definition.name] ?? 0) + 1;
      const callback = definition.execute as Tool["execute"];
      return callback(input, options);
    },
  }));
  const cleanups = wrapped.map(registerTool);
  const controller = new AbortController();
  try {
    const discoverySignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(5000),
    ]);
    let discovered = await withSignal(getTools(), discoverySignal);
    const required = [
      "list_conversations",
      "send_message",
      "delete_conversation",
    ];
    while (
      !required.every((name) => discovered.some((tool) => tool.name === name))
    ) {
      await withSignal(
        new Promise<void>((resolve) => setTimeout(resolve, 50)),
        discoverySignal,
      );
      discovered = await withSignal(getTools(), discoverySignal);
    }
    const find = (name: string) => {
      const tool = discovered.find((tool) => tool.name === name);
      if (!tool) throw new Error(`Discovery omitted ${name}`);
      return tool;
    };
    await executeTool(find("list_conversations"), {}, { signal });
    const started = new Promise<void>((resolve) => {
      onSendStarted = resolve;
    });
    const invocation = executeTool(
      find("send_message"),
      { text: "Cancellation smoke" },
      { signal: AbortSignal.any([signal, controller.signal]) },
    );
    // Observe rejection immediately and abort only after the application callback starts.
    const outcome = invocation.then(
      () => "resolved",
      (error: unknown) => (error instanceof Error ? error.name : String(error)),
    );
    await withSignal(
      started,
      AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    );
    controller.abort();
    const cancellation = await withSignal(outcome, AbortSignal.timeout(5000));
    if (cancellation !== "AbortError")
      throw new Error(`Cancellation returned ${cancellation}`);
    const deletion = find("delete_conversation");
    if (definitions[4].annotations?.consequentialHint !== true)
      throw new Error("Missing consequential annotation");
    await executeTool(deletion, { id: isolated.id }, { signal });
    if (threads.length !== 0)
      throw new Error("Isolated conversation was not deleted");
    for (const name of [
      "list_conversations",
      "send_message",
      "delete_conversation",
    ])
      if (counts[name] !== 1)
        throw new Error(`${name} executed ${counts[name]} times`);
    return {
      counts,
      nativeSignal,
      cancellation,
      isolatedConversation: isolated.id,
      discoveredTools: discovered.length,
      discoveredDeletionAnnotations: deletion.annotations ?? null,
      consequentialRegistration: definitions[4].annotations?.consequentialHint,
    };
  } finally {
    controller.abort();
    for (const cleanup of cleanups) cleanup();
  }
}
