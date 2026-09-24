import { ask } from "@web-ai-sdk/prompt";
import { executeTool, getTools, registerTool } from "@web-ai-sdk/webmcp";
import { useState } from "react";
import { executeUntilAbort } from "../experimental/agent/dispatcher.js";
import {
  detectLanguageTool,
  proofreadTool,
  rewriteTool,
  summarizeTool,
  translateTool,
  writeTool,
} from "../experimental/agent/tools/index.js";
import type { AgentTool } from "../experimental/agent/types.js";
import { createPlaygroundWebMCPTools } from "../lib/usePlaygroundWebMCPTools.js";

const tests: {
  name: string;
  tool: AgentTool;
  input: Record<string, unknown>;
}[] = [
  {
    name: "Writer",
    tool: writeTool,
    input: { task: "Write one sentence inviting a colleague to lunch." },
  },
  {
    name: "Rewriter",
    tool: rewriteTool,
    input: { text: "hey, please send the meeting notes", tone: "more-formal" },
  },
  {
    name: "Proofreader",
    tool: proofreadTool,
    input: { text: "She have two book.", expectedInputLanguages: ["en"] },
  },
  {
    name: "Summarizer",
    tool: summarizeTool,
    input: {
      text: "The team met on Monday. They reviewed the release and agreed to test the new build on Tuesday.",
    },
  },
  {
    name: "Translator en to pt",
    tool: translateTool,
    input: { text: "Hello", sourceLanguage: "en", targetLanguage: "pt" },
  },
  {
    name: "Language Detector",
    tool: detectLanguageTool,
    input: { text: "This is a sentence in English." },
  },
];

interface Result {
  name: string;
  status: "passed" | "failed" | "skipped";
  detail: unknown;
}

export function BrowserSmoke() {
  const [results, setResults] = useState<Result[]>([]);
  const [setup, setSetup] = useState(
    "Default profile; no trial token supplied by this harness",
  );
  const [running, setRunning] = useState<AbortController | null>(null);
  const [progress, setProgress] = useState("");
  const run = async (
    name: string,
    execute: (signal: AbortSignal) => Promise<unknown>,
  ) => {
    if (running) return;
    const controller = new AbortController();
    setRunning(controller);
    setProgress("");
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const detail = await executeUntilAbort(controller.signal, () =>
        execute(controller.signal),
      );
      setResults((current) => [...current, { name, status: "passed", detail }]);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      setResults((current) => [
        ...current,
        {
          name,
          status: failure.name.endsWith("UnavailableError")
            ? "skipped"
            : "failed",
          detail: { name: failure.name, message: failure.message },
        },
      ]);
    } finally {
      clearTimeout(timeout);
      setRunning(null);
    }
  };
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10 text-fg">
      <h1 className="text-2xl">Playground browser smoke tests</h1>
      <p>
        Each button invokes a real SDK operation. Model downloads can start
        after you select a test. Tests time out after 60 seconds.
      </p>
      <p>
        Conversation deletion uses an isolated in-memory conversation. Existing
        Playground conversations are not read or changed.
      </p>
      <label className="block">
        Browser setup, enabled flags, and origin trial status
        <input
          className="block w-full rounded bg-surface2 p-3"
          value={setup}
          onChange={(event) => setSetup(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded bg-surface2 px-4 py-2"
          disabled={!!running}
          onClick={() =>
            void run("Prompt", (signal) =>
              ask({
                input: "Reply with the word ready.",
                language: "en",
                signal,
              }),
            )
          }
        >
          Test Prompt
        </button>
        {tests.map(({ name, tool, input }) => (
          <button
            type="button"
            className="rounded bg-surface2 px-4 py-2"
            disabled={!!running}
            key={name}
            onClick={() =>
              void run(name, (signal) =>
                Promise.resolve(
                  tool.execute(input, {
                    signal,
                    callId: "smoke",
                    step: 0,
                    emit: (data) => setProgress(JSON.stringify(data)),
                  }),
                ),
              )
            }
          >
            Test {name}
          </button>
        ))}
        <button
          type="button"
          className="rounded bg-surface2 px-4 py-2"
          disabled={!!running}
          onClick={() =>
            void run(
              "WebMCP single execution and isolated deletion",
              testWebMCP,
            )
          }
        >
          Test WebMCP
        </button>
        <button
          type="button"
          className="rounded bg-surface2 px-4 py-2"
          disabled={!!running}
          onClick={() =>
            void run("WebMCP native cancellation", testWebMCPCancellation)
          }
        >
          Test WebMCP cancellation
        </button>
        <button
          type="button"
          className="rounded bg-surface2 px-4 py-2"
          disabled={!running}
          onClick={() => running?.abort()}
        >
          Cancel test
        </button>
      </div>
      <p role="status">{running ? `Running: ${progress}` : "Ready"}</p>
      <pre className="overflow-auto whitespace-pre-wrap break-words rounded bg-surface p-4">
        {JSON.stringify(
          {
            userAgent:
              typeof navigator === "undefined" ? "" : navigator.userAgent,
            setup,
            results,
          },
          null,
          2,
        )}
      </pre>
    </main>
  );
}

async function testWebMCP(signal: AbortSignal) {
  const id = `smoke-${crypto.randomUUID()}`;
  const conversation = {
    id,
    name: "Isolated smoke conversation",
    modeId: "minimal",
    turns: [],
    createdAt: 1,
    updatedAt: 1,
  };
  let deletions = 0;
  const definition = createPlaygroundWebMCPTools({
    threads: [conversation],
    activeThread: conversation,
    busy: false,
    send: async () => true,
    newSession() {},
    pushActivity() {},
    ops: {
      create: () => conversation,
      remove(target) {
        if (target !== id) throw new Error("Unexpected conversation");
        deletions++;
      },
      select() {},
      rename() {},
      touch() {},
      appendTurn() {},
      setMode() {},
    },
  })[4];
  if (definition.name !== "delete_conversation")
    throw new Error(`Expected delete_conversation, got ${definition.name}`);
  const name = `playground_smoke_delete_${id.replaceAll("-", "_")}`;
  const cleanup = registerTool({ ...definition, name });
  try {
    const tool = (await getTools()).find(
      (candidate) => candidate.name === name,
    );
    if (!tool) throw new Error("Smoke tool was not discovered");
    const result = await executeTool(tool, { id }, { signal });
    if (deletions !== 1)
      throw new Error(`Expected one deletion, got ${deletions}`);
    return {
      invocationCount: deletions,
      result,
      schemaShape: typeof tool.inputSchema,
    };
  } finally {
    cleanup();
  }
}

async function testWebMCPCancellation(signal: AbortSignal) {
  const name = `playground_smoke_cancel_${crypto.randomUUID().replaceAll("-", "_")}`;
  let invocations = 0;
  let nativeAborted = false;
  const controller = new AbortController();
  const cleanup = registerTool({
    name,
    description: "Isolated cancellation smoke test",
    readOnly: true,
    execute: async (_input: unknown, options) => {
      invocations++;
      if (!options?.signal)
        throw new Error("Host omitted callback cancellation signal");
      const nativeSignal = options.signal;
      queueMicrotask(() => controller.abort());
      try {
        await executeUntilAbort(
          nativeSignal,
          () => new Promise<void>((resolve) => setTimeout(resolve, 500)),
        );
      } catch (error) {
        nativeAborted = nativeSignal.aborted;
        throw error;
      }
      return "Native callback was not cancelled";
    },
  });
  try {
    const tool = (await getTools()).find(
      (candidate) => candidate.name === name,
    );
    if (!tool) throw new Error("Smoke tool was not discovered");
    try {
      await executeTool(
        tool,
        {},
        { signal: AbortSignal.any([signal, controller.signal]) },
      );
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "AbortError") throw error;
    }
    // Native callback rejection can follow the caller's abort rejection.
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    if (invocations !== 1 || !nativeAborted)
      throw new Error(
        `invocations=${invocations}, native cancellation=${nativeAborted}`,
      );
    return { invocations, nativeAborted };
  } finally {
    cleanup();
  }
}
