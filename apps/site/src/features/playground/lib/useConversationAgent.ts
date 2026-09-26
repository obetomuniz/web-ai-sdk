import { summarize } from "@web-ai-sdk/summarizer";
import { useCallback, useRef, useState } from "react";
import { useAgent } from "../experimental/agent/react/index.js";
import type { AgentMode } from "../experimental/playground/presets.js";
import { activityPreview } from "./activity.js";
import { type AgentThread, deriveThreadName } from "./agentThreads.js";
import type { PromptReadiness } from "./promptReadiness.js";
import type { ActivityEvent } from "./types.js";
import type { AgentThreadOps } from "./useAgentThreads.js";

interface Args {
  thread: AgentThread;
  mode: AgentMode;
  ops: AgentThreadOps;
  promptOn: boolean;
  promptReadiness?: PromptReadiness;
  summarizerOn: boolean;
  pushActivity: (event: Omit<ActivityEvent, "id" | "ts">) => void;
}

export function useConversationAgent({
  thread,
  mode,
  ops,
  promptOn,
  promptReadiness,
  summarizerOn,
  pushActivity,
}: Args) {
  // Chrome reports progress on every session create; track real downloads only.
  const promptDownloadingRef = useRef(false);
  promptDownloadingRef.current =
    promptReadiness === "downloadable" || promptReadiness === "downloading";
  const [promptDownload, setPromptDownload] = useState<number | null>(null);
  const [currentInput, setCurrentInput] = useState("");
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const currentRunRef = useRef<{
    conversationId: string;
    turnId: string;
    isFirstTurn: boolean;
  } | null>(null);

  const agent = useAgent({
    systemPrompt: mode.systemPrompt,
    tools: mode.tools,
    initialTurns: thread.turns,
    sessionKey: `${thread.id}:${mode.id}`,
    maxSteps: 6,
    sessionMode: "thread",
    samplingMode: "predictable",
    language: "en",
    onToolError: mode.id === "web-ai-suite" ? "stop" : "report",
    requireToolResult: mode.id === "web-ai-suite",
    // Download progress updates the runtime check in place, not Activity.
    onModelDownload: (loaded) => {
      if (promptDownloadingRef.current) setPromptDownload(loaded);
    },
    onEvent: (event) => {
      if (event.type === "tool_result") {
        const outcome =
          event.error?.name === "AbortError"
            ? "cancelled"
            : event.error?.name?.endsWith("UnavailableError")
              ? "unavailable"
              : event.error?.name === "AgentToolValidationError"
                ? "invalid input"
                : event.error
                  ? "operational error"
                  : "success";
        pushActivity({
          kind: "tool_invoked",
          message: `${event.name}: ${outcome}`,
          detail: event.error?.message,
        });
      }
      if (
        event.type === "tool_progress" &&
        event.data &&
        typeof event.data === "object" &&
        "phase" in event.data &&
        event.data.phase !== "output" &&
        event.data.phase !== "download"
      ) {
        pushActivity({
          kind: "info",
          message: event.name,
          detail: describeProgress(event.data),
        });
      }
    },
    onTurnComplete: (turn) => {
      const currentRun = currentRunRef.current;
      if (!currentRun) return;
      ops.appendTurn(currentRun.conversationId, turn, currentRun.turnId);
      if (currentRun.isFirstTurn) {
        void generateConversationTitle(
          currentRun.conversationId,
          turn.userInput,
          turn.assistantText,
          summarizerOn &&
            turn.stopReason === "done" &&
            Boolean(turn.assistantText.trim()),
          ops.rename,
        );
      }
      // The Stop button records the user action synchronously. Avoid a second
      // terminal Activity row for the same cancellation.
      if (turn.stopReason === "aborted") return;
      const complete = turn.stopReason === "done";
      const requestPreview = activityPreview(turn.userInput, "Request");
      pushActivity({
        kind: complete ? "chat_response" : "chat_error",
        message: complete
          ? activityPreview(turn.assistantText, "Response completed")
          : activityPreview(
              turn.failure?.message ?? "",
              turn.stopReason ?? "Response stopped",
            ),
        detail: complete
          ? `Reply to “${requestPreview}”`
          : `Request “${requestPreview}”`,
      });
    },
  });

  const busy =
    agent.isStreamingTurn ||
    agent.status === "planning" ||
    agent.status === "tool_calling" ||
    agent.status === "streaming";

  const send = useCallback(
    async (textToSend: string, signal?: AbortSignal) => {
      signal?.throwIfAborted();
      const trimmed = textToSend.trim();
      if (!trimmed || busy || currentRunRef.current || !promptOn) return false;
      const turnId = crypto.randomUUID();
      const conversationId = thread.id;
      currentTurnIdRef.current = turnId;
      currentRunRef.current = {
        conversationId,
        turnId,
        isFirstTurn: thread.turns.length === 0,
      };
      setCurrentTurnId(turnId);
      ops.touch(conversationId);
      pushActivity({
        kind: "chat_send",
        message: activityPreview(trimmed, "Message sent"),
      });
      setCurrentInput(trimmed);
      const cancelOwnedRun = () => {
        if (currentRunRef.current?.turnId !== turnId) return;
        agent.abort();
        pushActivity({
          kind: "chat_abort",
          message: "WebMCP cancelled response",
          detail: conversationId,
        });
      };
      signal?.addEventListener("abort", cancelOwnedRun, { once: true });
      try {
        await agent.run(trimmed);
        signal?.throwIfAborted();
        return true;
      } finally {
        signal?.removeEventListener("abort", cancelOwnedRun);
        if (currentTurnIdRef.current === turnId) {
          currentTurnIdRef.current = null;
          currentRunRef.current = null;
          setCurrentTurnId((current) => (current === turnId ? null : current));
          setCurrentInput("");
        }
      }
    },
    [
      agent.run,
      agent.abort,
      busy,
      ops,
      promptOn,
      pushActivity,
      thread.id,
      thread.turns.length,
    ],
  );

  return {
    ...agent,
    busy,
    promptDownload,
    currentInput,
    currentTurnId,
    send,
  };
}

async function generateConversationTitle(
  conversationId: string,
  userInput: string,
  assistantText: string,
  canSummarize: boolean,
  rename: (id: string, name: string) => void,
): Promise<void> {
  const fallbackTitle = deriveThreadName(userInput);
  if (!canSummarize) {
    rename(conversationId, fallbackTitle);
    return;
  }
  try {
    const result = await summarize({
      input: `User request\n${userInput}\n\nAssistant response\n${assistantText}`,
      language: "und",
      type: "headline",
      length: "short",
      preference: "auto",
      sharedContext:
        "Create a concise, specific title for this AI conversation. Return only the title.",
      cache: "session",
      cacheKey: `playground:conversation-title:${conversationId}`,
    });
    const title = result.output
      ?.replace(/^#+\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    rename(conversationId, title || fallbackTitle);
  } catch {
    rename(conversationId, fallbackTitle);
  }
}

function describeProgress(data: object): string {
  const { phase, state } = data as {
    phase?: unknown;
    state?: unknown;
  };
  if (phase === "readiness") return `Readiness: ${String(state)}`;
  return JSON.stringify(data);
}
