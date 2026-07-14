import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentTurn } from "../experimental/agent/types.js";
import {
  type AgentThread,
  createAgentThread,
  deriveThreadName,
  findSkill,
  loadAgentThreadState,
  saveAgentThreadState,
} from "./agentThreads.js";

interface State {
  threads: AgentThread[];
  activeId: string;
}

export interface AgentThreadOps {
  create(skillId?: string): AgentThread;
  remove(id: string): void;
  select(id: string): void;
  rename(id: string, name: string): void;
  appendTurn(id: string, turn: AgentTurn): void;
  clearTurns(id: string): void;
  setSkill(id: string, skillId: string): void;
}

export function useAgentThreads() {
  const [state, setState] = useState<State>(() => loadAgentThreadState());

  useEffect(() => {
    saveAgentThreadState(state);
  }, [state]);

  const activeThread = useMemo(
    () =>
      state.threads.find((thread) => thread.id === state.activeId) ??
      state.threads[0] ??
      createAgentThread(),
    [state.activeId, state.threads],
  );

  const activeSkill = useMemo(
    () => findSkill(activeThread.skillId),
    [activeThread.skillId],
  );

  const create = useCallback((skillId?: string): AgentThread => {
    const thread = createAgentThread(skillId);
    setState((current) => ({
      threads: [...current.threads, thread],
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
          ? (list.at(-1) ?? createAgentThread()).id
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
        thread.id === id ? { ...thread, name } : thread,
      ),
    }));
  }, []);

  const appendTurn = useCallback((id: string, turn: AgentTurn) => {
    setState((current) => ({
      ...current,
      threads: current.threads.map((thread) => {
        if (thread.id !== id) return thread;
        const named =
          thread.name === "New thread"
            ? deriveThreadName(turn.userInput)
            : thread.name;
        return {
          ...thread,
          name: named,
          turns: [
            ...thread.turns,
            {
              ...turn,
              id: crypto.randomUUID(),
              createdAt: Date.now(),
            },
          ],
        };
      }),
    }));
  }, []);

  const clearTurns = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      threads: current.threads.map((thread) =>
        thread.id === id ? { ...thread, turns: [] } : thread,
      ),
    }));
  }, []);

  const setSkill = useCallback((id: string, skillId: string) => {
    const next = findSkill(skillId);
    setState((current) => ({
      ...current,
      threads: current.threads.map((thread) =>
        thread.id === id ? { ...thread, skillId: next.id } : thread,
      ),
    }));
  }, []);

  const ops = useMemo<AgentThreadOps>(
    () => ({
      create,
      remove,
      select,
      rename,
      appendTurn,
      clearTurns,
      setSkill,
    }),
    [appendTurn, clearTurns, create, remove, rename, select, setSkill],
  );

  return {
    threads: state.threads,
    activeThread,
    activeSkill,
    activeId: state.activeId,
    ops,
  };
}
