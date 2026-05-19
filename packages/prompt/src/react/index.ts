import { useCallback, useEffect, useRef, useState } from "react";
import {
  type PromptOptions,
  type PromptResult,
  PromptUnavailableError,
  isPromptAvailable,
  prompt as runPrompt,
} from "../index.js";

export type PromptStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "done"
  | "unavailable";

export interface UsePromptOptions
  extends Omit<PromptOptions, "prompt" | "onChunk" | "signal"> {}

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

  const ask = useCallback(async (input: string): Promise<void> => {
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
      const result: PromptResult = await runPrompt({
        ...optionsRef.current,
        prompt: input,
        signal: controller.signal,
        onChunk: (chunk) => {
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

  return { status, response, error, fromCache, ask, abort, reset };
};

export type {
  PromptOptions,
  PromptResult,
  ResponseCache,
} from "../index.js";
