import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AskOptions,
  type AskResult,
  type CreateSessionOptions,
  PromptUnavailableError,
  type Session,
  ask,
  createSession,
  isPromptAvailable,
} from "../index.js";

export type PromptStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "done"
  | "unavailable";

export interface UsePromptOptions
  extends Omit<AskOptions, "input" | "onUpdate" | "signal"> {}

export interface UsePromptReturn {
  status: PromptStatus;
  response: string | null;
  error: Error | null;
  /** Whether the most recent result was loaded from cache (no model call). */
  fromCache: boolean;
  /** Trigger a prompt run. Cancels any in-flight request first. */
  ask(input: string): Promise<void>;
  /** Cancel the in-flight request, if any. Status flips to `idle`. */
  abort(): void;
  /** Reset to `idle` and clear the response. Does not cancel an in-flight request. */
  reset(): void;
}

/**
 * Run prompts on demand. `ask(input)` triggers the request and updates state
 * as chunks stream. Pass `cache`, `createOptions`, etc. as stable references
 * (memoize if necessary); the hook keeps them in a ref to avoid stale-closure
 * issues without forcing the consumer to re-render on every change.
 *
 * For multi-turn chat where each conversation needs its own context,
 * system prompt, and lifecycle (so `abort()` on one chat doesn't kill
 * the others), prefer `useSession`.
 */
export const usePrompt = (options: UsePromptOptions = {}): UsePromptReturn => {
  const [status, setStatus] = useState<PromptStatus>(() =>
    isPromptAvailable() ? "idle" : "unavailable",
  );
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const controllerRef = useRef<AbortController | null>(null);

  // If the API disappears (e.g. across HMR), flip back to "unavailable".
  useEffect(() => {
    if (!isPromptAvailable()) setStatus("unavailable");
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus((s) => (s === "loading" || s === "streaming" ? "idle" : s));
  }, []);

  const reset = useCallback(() => {
    setResponse(null);
    setError(null);
    setFromCache(false);
    setStatus(isPromptAvailable() ? "idle" : "unavailable");
  }, []);

  const askMethod = useCallback(async (input: string): Promise<void> => {
    if (!isPromptAvailable()) {
      setStatus("unavailable");
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setError(null);
    setResponse(null);
    setFromCache(false);
    setStatus("loading");

    try {
      const result: AskResult = await ask({
        ...optionsRef.current,
        input,
        signal: controller.signal,
        onUpdate: (chunk) => {
          if (controller.signal.aborted) return;
          setResponse(chunk);
          setStatus("streaming");
        },
      });
      if (controller.signal.aborted) return;
      if (!result.response) {
        setStatus("idle");
        return;
      }
      setResponse(result.response);
      setFromCache(result.cached);
      setStatus("done");
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      if ((err as { name?: string })?.name === "AbortError") return;
      if (err instanceof PromptUnavailableError) {
        setStatus("unavailable");
        return;
      }
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("idle");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  // Abort any in-flight request on unmount.
  useEffect(() => () => controllerRef.current?.abort(), []);

  return { status, response, error, fromCache, ask: askMethod, abort, reset };
};

export type SessionStatus = "loading" | "ready" | "unavailable";

export interface UseSessionOptions extends CreateSessionOptions {
  /** Skip session creation when `false`. Default: `true`. */
  enabled?: boolean;
}

export interface UseSessionReturn {
  /** `"loading"` while the underlying session is being created, `"ready"` once usable, `"unavailable"` when the API is missing or creation failed. */
  status: SessionStatus;
  /** Creation error, if any. */
  error: Error | null;
  /** The session itself. `null` until `status === "ready"`. */
  session: Session | null;
}

/**
 * Lifecycle-only React adapter for `createSession`. Each call owns one
 * underlying `LanguageModel` session with its own history, system prompt,
 * sampling, and lifecycle — `abort()` / `destroy()` on one component's
 * session never touch another's — and the session is destroyed on unmount
 * or when any primitive option (`systemPrompt`, `temperature`, `topK`,
 * `language`, `enabled`) changes.
 *
 * Token-level interleaving across sessions is browser-defined: the
 * underlying on-device model is single-instance, so Chrome 148 / Edge 138
 * currently serialize `sendStreaming` calls across sessions FIFO. The
 * second component's send waits for the first to drain. The API is
 * forward-compatible for runtimes that expose parallel inference.
 *
 * The hook intentionally does **not** track `response` / `history` /
 * streaming status. Iterate `session.sendStreaming()` yourself and keep UI
 * state in your own components. The hook only solves the React lifecycle:
 * feature detection, create, destroy, recreate-on-change.
 *
 * Object options (`expectedInputs`, `createOptions`) participate in the
 * effect dependency check by reference; memoize them or accept the recreate
 * cost.
 */
export const useSession = (
  options: UseSessionOptions = {},
): UseSessionReturn => {
  const {
    enabled = true,
    systemPrompt,
    temperature,
    topK,
    language,
    supportedLanguages,
    expectedInputs,
    expectedOutputs,
    createOptions,
  } = options;

  const [state, setState] = useState<{
    status: SessionStatus;
    session: Session | null;
    error: Error | null;
  }>(() => ({
    status: isPromptAvailable() && enabled ? "loading" : "unavailable",
    session: null,
    error: null,
  }));

  useEffect(() => {
    if (!enabled || !isPromptAvailable()) {
      setState({ status: "unavailable", session: null, error: null });
      return;
    }

    let session: Session;
    try {
      session = createSession({
        systemPrompt,
        temperature,
        topK,
        language,
        supportedLanguages,
        expectedInputs,
        expectedOutputs,
        createOptions,
      });
    } catch (err) {
      if (err instanceof PromptUnavailableError) {
        setState({ status: "unavailable", session: null, error: null });
        return;
      }
      setState({
        status: "unavailable",
        session: null,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return;
    }
    // `status: "ready"` means the session object exists and is usable.
    // Sends await the underlying `LanguageModel.create()` internally; if
    // creation fails, the consumer sees `PromptUnavailableError` on the
    // first send. The hook does not pre-detect creation errors — that
    // would require an extra observation channel we deliberately don't expose.
    setState({ status: "ready", session, error: null });

    return () => {
      session.destroy();
    };
  }, [
    enabled,
    systemPrompt,
    temperature,
    topK,
    language,
    supportedLanguages,
    expectedInputs,
    expectedOutputs,
    createOptions,
  ]);

  return state;
};

export type {
  AskOptions,
  AskResult,
  ResponseCache,
  CreateSessionOptions,
  Session,
} from "../index.js";
