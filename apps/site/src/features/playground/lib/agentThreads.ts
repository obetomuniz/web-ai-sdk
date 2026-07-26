import type { AgentTurn } from "../experimental/agent/types.js";
import type { AgentMode } from "../experimental/playground/presets.js";
import { MODES } from "../experimental/playground/presets.js";

export interface AgentThreadTurn extends AgentTurn {
  id: string;
  createdAt: number;
}

export interface AgentThread {
  id: string;
  name: string;
  modeId: string;
  turns: AgentThreadTurn[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentThreadState {
  threads: AgentThread[];
  activeId: string;
}

export const DEFAULT_MODE_ID = "platform";
export const DEFAULT_THREAD_NAME = "New conversation";

export const STORAGE_KEY = "web-ai-sdk:playground:v1:agent-threads";

export function findMode(id: string): AgentMode {
  return MODES.find((mode) => mode.id === id) ?? MODES[0];
}

export function createAgentThread(
  modeId: string = DEFAULT_MODE_ID,
): AgentThread {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: DEFAULT_THREAD_NAME,
    modeId: findMode(modeId).id,
    turns: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function sortAgentThreads(threads: AgentThread[]): AgentThread[] {
  return [...threads].sort(
    (left, right) =>
      right.updatedAt - left.updatedAt || right.createdAt - left.createdAt,
  );
}

export function deriveThreadName(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed || DEFAULT_THREAD_NAME;
}

function recoverLegacyThreadName(
  name: string,
  turns: AgentThreadTurn[],
): string {
  if (!name.endsWith("...")) return name;
  const firstInput = turns[0]?.userInput.trim().replace(/\s+/g, " ");
  const storedPrefix = name.slice(0, -3);
  return firstInput?.startsWith(storedPrefix) ? firstInput : name;
}

function isThreadTurn(value: unknown): value is AgentThreadTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Partial<AgentThreadTurn>;
  return (
    typeof turn.id === "string" &&
    typeof turn.createdAt === "number" &&
    typeof turn.userInput === "string" &&
    typeof turn.assistantText === "string" &&
    Array.isArray(turn.steps)
  );
}

function parseThread(value: unknown): AgentThread | undefined {
  if (!value || typeof value !== "object") return undefined;
  const thread = value as Partial<AgentThread> & { skillId?: unknown };
  const turns = Array.isArray(thread.turns)
    ? thread.turns.filter(isThreadTurn)
    : undefined;
  const modeId =
    typeof thread.modeId === "string"
      ? thread.modeId
      : typeof thread.skillId === "string"
        ? thread.skillId
        : undefined;
  if (
    typeof thread.id !== "string" ||
    typeof thread.name !== "string" ||
    !modeId ||
    !turns ||
    typeof thread.createdAt !== "number"
  ) {
    return undefined;
  }
  return {
    id: thread.id,
    name:
      thread.name === "New thread"
        ? DEFAULT_THREAD_NAME
        : recoverLegacyThreadName(thread.name, turns),
    modeId: findMode(modeId).id,
    turns,
    createdAt: thread.createdAt,
    updatedAt:
      typeof thread.updatedAt === "number"
        ? thread.updatedAt
        : Math.max(thread.createdAt, ...turns.map((turn) => turn.createdAt)),
  };
}

export function normalizeAgentThreadState(
  value: unknown,
): AgentThreadState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const parsed = value as Partial<AgentThreadState>;
  if (!Array.isArray(parsed.threads) || parsed.threads.length === 0) {
    return undefined;
  }

  const threads = parsed.threads.flatMap((thread) => {
    const normalized = parseThread(thread);
    return normalized ? [normalized] : [];
  });
  const sortedThreads = sortAgentThreads(threads);
  const firstThread = sortedThreads[0];
  if (!firstThread) return undefined;
  const activeId =
    sortedThreads.find((thread) => thread.id === parsed.activeId)?.id ??
    firstThread.id;
  return { threads: sortedThreads, activeId };
}

export function loadAgentThreadState(): AgentThreadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const normalized = raw
      ? normalizeAgentThreadState(JSON.parse(raw) as unknown)
      : undefined;
    return normalized ?? createDefaultThreadState();
  } catch {
    return createDefaultThreadState();
  }
}

function createDefaultThreadState(): AgentThreadState {
  const first = createAgentThread();
  return { threads: [first], activeId: first.id };
}

export function saveAgentThreadState(state: AgentThreadState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / disabled storage
  }
}
