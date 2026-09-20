import {
  checkAvailability,
  prepareSummarizer,
  summarize,
} from "@web-ai-sdk/summarizer";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAgent } from "../experimental/agent/react/index.js";
import { toolOutcome } from "../experimental/agent/toolOutcome.js";
import {
  type downloadMonitor,
  runPrepared,
} from "../experimental/agent/tools/lifecycle.js";
import type { AgentEvent } from "../experimental/agent/types.js";
import type { AgentMode } from "../experimental/playground/presets.js";
import { activityPreview } from "./activity.js";
import { type AgentThread, deriveThreadName } from "./agentThreads.js";
import type { ActivityEvent } from "./types.js";
import type { AgentThreadOps } from "./useAgentThreads.js";
import { titleOptions } from "./useCapabilityReadiness.js";

interface Args {
  thread: AgentThread;
  mode: AgentMode;
  ops: AgentThreadOps;
  promptOn: boolean;
  summarizerOn: boolean;
  pushActivity: (event: Omit<ActivityEvent, "id" | "ts">) => void;
}

export function useConversationAgent({
  thread,
  mode,
  ops,
  promptOn,
  summarizerOn,
  pushActivity,
}: Args) {
  const [titleLifecycle, setTitleLifecycle] = useState<string | null>(null);
  const [capabilityEvents, setCapabilityEvents] = useState<AgentEvent[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const currentRunRef = useRef<{
    conversationId: string;
    turnId: string;
    isFirstTurn: boolean;
  } | null>(null);

  const titleController = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Title work belongs to this conversation and mode.
  useEffect(() => {
    setCapabilityEvents([]);
    setTitleLifecycle(null);
    return () => {
      titleController.current?.abort();
    };
  }, [thread.id, mode.id]);
  const monitor = useCallback(
    (progressMonitor: Parameters<ReturnType<typeof downloadMonitor>>[0]) => {
      progressMonitor.addEventListener("downloadprogress", ({ loaded }) => {
        pushActivity({
          kind: "info",
          message: "Prompt model download",
          detail: `${Math.round(loaded * 100)}%`,
        });
      });
    },
    [pushActivity],
  );

  const agent = useAgent({
    monitor,
    onEvent: (event) => {
      if (
        event.type === "tool_call" ||
        event.type === "tool_result" ||
        (event.type === "tool_progress" &&
          event.data &&
          typeof event.data === "object" &&
          (event.data as { phase?: string }).phase !== "output")
      ) {
        setCapabilityEvents((previous) => {
          const next =
            event.type === "tool_progress"
              ? previous.filter(
                  (entry) =>
                    entry.type !== "tool_progress" ||
                    entry.callId !== event.callId ||
                    (entry.data as { phase?: string } | undefined)?.phase !==
                      (event.data as { phase?: string } | undefined)?.phase,
                )
              : previous;
          return [...next, event].slice(-100);
        });
      }
      if (event.type === "tool_result")
        pushActivity({
          kind: "tool_invoked",
          message: `${event.name}: ${toolOutcome(event)}`,
          detail: event.error?.message,
        });
    },
    systemPrompt: mode.systemPrompt,
    strictTools: mode.strictTools,
    tools: mode.tools,
    initialTurns: thread.turns,
    sessionKey: `${thread.id}:${mode.id}`,
    maxSteps: 6,
    sessionMode: "thread",
    samplingMode: "predictable",
    language: "en",
  });

  const busy =
    agent.status === "planning" ||
    agent.status === "tool_calling" ||
    agent.status === "streaming";

  const send = useCallback(
    async (textToSend: string, options?: { signal?: AbortSignal }) => {
      const trimmed = textToSend.trim();
      if (!trimmed || busy || currentRunRef.current || !promptOn) return false;
      if (options?.signal?.aborted)
        throw new DOMException("Operation cancelled.", "AbortError");
      const turnId = crypto.randomUUID();
      const conversationId = thread.id;
      currentTurnIdRef.current = turnId;
      currentRunRef.current = {
        conversationId,
        turnId,
        isFirstTurn: thread.turns.length === 0,
      };
      setCurrentTurnId(turnId);
      setCapabilityEvents([]);
      ops.touch(conversationId);
      pushActivity({
        kind: "chat_send",
        message: activityPreview(trimmed, "Message sent"),
      });
      setCurrentInput(trimmed);
      try {
        const turn = await agent.run(trimmed, options);
        if (turn) {
          ops.appendTurn(conversationId, turn, turnId);
          if (thread.turns.length === 0 && turn.stopReason !== "aborted") {
            const controller = new AbortController();
            titleController.current?.abort();
            titleController.current = controller;
            void generateConversationTitle(
              conversationId,
              turn.userInput,
              turn.assistantText,
              summarizerOn &&
                turn.stopReason === "done" &&
                Boolean(turn.assistantText.trim()),
              ops.rename,
              controller.signal,
              (data) => {
                if (controller.signal.aborted) return;
                if (data && typeof data === "object") {
                  const progress = data as { phase?: string; state?: string };
                  if (progress.phase === "readiness")
                    setTitleLifecycle(progress.state ?? "unknown");
                  if (progress.phase === "download")
                    setTitleLifecycle("downloading");
                  if (progress.phase === "error") setTitleLifecycle("error");
                }
                pushActivity({
                  kind: "info",
                  message: "Summarizer · title",
                  detail: JSON.stringify(data),
                });
              },
            );
          }
          pushActivity({
            kind:
              turn.stopReason === "done"
                ? "chat_response"
                : turn.stopReason === "aborted"
                  ? "chat_abort"
                  : "chat_error",
            message: activityPreview(
              turn.assistantText,
              turn.stopReason ?? "Response stopped",
            ),
            detail: `Reply to “${activityPreview(trimmed, "Request")}”`,
          });
        }
        if (options?.signal?.aborted)
          throw new DOMException("Operation cancelled.", "AbortError");
        return true;
      } finally {
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
      busy,
      ops,
      promptOn,
      pushActivity,
      thread.id,
      thread.turns.length,
      summarizerOn,
    ],
  );

  return {
    ...agent,
    capabilityEvents,
    titleLifecycle,
    isBusy: () => currentRunRef.current !== null,
    busy,
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
  signal: AbortSignal,
  emit: (data: unknown) => void,
): Promise<void> {
  const fallbackTitle = deriveThreadName(userInput);
  if (!canSummarize) {
    rename(conversationId, fallbackTitle);
    return;
  }
  try {
    const result = await runPrepared(
      { signal, emit, callId: `title:${conversationId}`, step: -1 },
      () =>
        checkAvailability({
          type: titleOptions.type,
          format: titleOptions.format,
          length: titleOptions.length,
          preference: titleOptions.preference,
        }),
      (monitor) => prepareSummarizer({ ...titleOptions, monitor }),
      () =>
        summarize({
          signal,
          input: `User request\n${userInput}\n\nAssistant response\n${assistantText}`,
          ...titleOptions,
          cache: "session",
          cacheKey: `playground:conversation-title:${conversationId}`,
        }),
    );
    const title = result.output
      ?.replace(/^#+\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    rename(conversationId, title || fallbackTitle);
  } catch (error) {
    if (signal.aborted) return;
    emit({
      phase: "error",
      message: error instanceof Error ? error.message : String(error),
      fallback: "Title derived from request",
    });
    rename(conversationId, fallbackTitle);
  }
}
