import { useEffect, useState } from "react";
import {
  isAvailable,
  ProofreaderUnavailableError,
  type ProofreadOptions,
  type ProofreadResult,
  proofread,
} from "../index.js";

export type ProofreaderStatus = "idle" | "loading" | "done" | "unavailable";

export interface UseProofreaderOptions
  extends Omit<ProofreadOptions, "input" | "signal"> {
  /** Text to proofread. When falsy / whitespace-only the hook stays `idle`. */
  input: string;
  /** Whether to automatically run on mount / input change. Default: `true`. */
  enabled?: boolean;
}

export interface UseProofreaderReturn {
  status: ProofreaderStatus;
  /** Proofread output, or `null` while idle / unavailable. */
  output: ProofreadResult["output"];
  error: Error | null;
  /** Whether the result was loaded from cache (no model call). */
  fromCache: boolean;
}

/**
 * Auto-proofread `input` on mount and re-run when it changes. Stays in
 * `"idle"` until the input is non-empty. Pass `cache` (stable reference) to
 * enable the result cache.
 */
export const useProofreader = (
  options: UseProofreaderOptions,
): UseProofreaderReturn => {
  const [status, setStatus] = useState<ProofreaderStatus>(() =>
    isAvailable() ? "idle" : "unavailable",
  );
  const [output, setOutput] = useState<ProofreadResult["output"]>(null);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const {
    input,
    expectedInputLanguages,
    monitor,
    cache,
    cacheKey,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;
    if (!isAvailable()) {
      setStatus("unavailable");
      return;
    }
    if (!input.trim()) {
      setStatus("idle");
      setOutput(null);
      return;
    }

    const controller = new AbortController();
    setError(null);
    setStatus("loading");

    proofread({
      input,
      expectedInputLanguages,
      monitor,
      cache,
      cacheKey,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setOutput(result.output);
        setFromCache(result.cached);
        setStatus("done");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if ((err as { name?: string })?.name === "AbortError") return;
        if (err instanceof ProofreaderUnavailableError) {
          setStatus("unavailable");
          return;
        }
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("unavailable");
      });

    return () => {
      controller.abort();
    };
  }, [enabled, input, expectedInputLanguages, monitor, cache, cacheKey]);

  return { status, output, error, fromCache };
};

export type {
  CacheOption,
  ProofreadCache,
  ProofreadCorrection,
  ProofreadOptions,
  ProofreadOutput,
  ProofreadResult,
} from "../index.js";
