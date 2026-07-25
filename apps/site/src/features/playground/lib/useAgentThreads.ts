import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentTurn } from "../experimental/agent/types.js";
import {
  type AgentThread,
  createAgentThread,
  DEFAULT_THREAD_NAME,
  deriveThreadName,
  findMode,
  loadAgentThreadState,
  saveAgentThreadState,
  sortAgentThreads,
} from "./agentThreads.js";

interface State {
  threads: AgentThread[];
  activeId: string;
}

export interface AgentThreadOps {
  create(modeId?: string): AgentThread;
  remove(id: string): void;
  select(id: string): void;
  rename(id: string, name: string): void;
  touch(id: string): void;
  appendTurn(id: string, turn: AgentTurn, turnId?: string): void;
  setMode(id: string, modeId: string): void;
}

export function useAgentThreads() {
  const [state, setState] = useState<State>(() => loadAgentThreadState());

  useEffect(() => {
    saveAgentThreadState(state);
  }, [state]);

  const threads = useMemo(
    () => sortAgentThreads(state.threads),
    [state.threads],
  );

  const activeThread = useMemo(
    () =>
      threads.find((thread) => thread.id === state.activeId) ??
      threads[0] ??
      createAgentThread(),
    [state.activeId, threads],
  );

  const activeMode = useMemo(
    () => findMode(activeThread.modeId),
    [activeThread.modeId],
  );

  const create = useCallback((modeId?: string): AgentThread => {
    const thread = createAgentThread(modeId);
    setState((current) => ({
      threads: [thread, ...current.threads],
      activeId: thread.id,
    }));
    return thread;
  }, []);

  const remove = useCallback((id: string) => {
    setState((current) => {
      const remaining = current.threads.filter((thread) => thread.id !== id);
      const list = remaining.length > 0 ? remaining : [createAgentThread()];
      const activeId =
        current.activeId === id
          ? (sortAgentThreads(list)[0] ?? createAgentThread()).id
          : current.activeId;
      return { threads: list, activeId };
    });
  }, []);

  const select = useCallback((id: string) => {
    setState((current) =>
      current.activeId === id ? current : { ...current, activeId: id },
    );
  }, []);

  const rename = useCallback((id: string, name: string) => {
    setState((current) => ({
      ...current,
      threads: current.threads.map((thread) =>
        thread.id === id ? { ...thread, name, updatedAt: Date.now() } : thread,
      ),
    }));
  }, []);

  const touch = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      threads: current.threads.map((thread) =>
        thread.id === id ? { ...thread, updatedAt: Date.now() } : thread,
      ),
    }));
  }, []);

  const appendTurn = useCallback(
    (id: string, turn: AgentTurn, turnId?: string) => {
      const updatedAt = Date.now();
      setState((current) => ({
        ...current,
        threads: current.threads.map((thread) => {
          if (thread.id !== id) return thread;
          const named =
            thread.name === DEFAULT_THREAD_NAME
              ? deriveThreadName(turn.userInput)
              : thread.name;
          return {
            ...thread,
            name: named,
            updatedAt,
            turns: [
              ...thread.turns,
              {
                ...turn,
                id: turnId ?? crypto.randomUUID(),
                createdAt: updatedAt,
              },
            ],
          };
        }),
      }));
    },
    [],
  );

  const setMode = useCallback((id: string, modeId: string) => {
    const next = findMode(modeId);
    setState((current) => ({
      ...current,
      threads: current.threads.map((thread) =>
        thread.id === id
          ? { ...thread, modeId: next.id, updatedAt: Date.now() }
          : thread,
      ),
    }));
  }, []);

  const ops = useMemo<AgentThreadOps>(
    () => ({
      create,
      remove,
      select,
      rename,
      touch,
      appendTurn,
      setMode,
    }),
    [appendTurn, create, remove, rename, select, setMode, touch],
  );

  return {
    threads,
    activeThread,
    activeMode,
    activeId: state.activeId,
    ops,
  };
}
