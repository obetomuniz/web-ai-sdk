import { useEffect, useState } from "react";
import {
  isAvailable,
  type RewriteOptions,
  RewriterUnavailableError,
  rewrite,
} from "../index.js";

export type RewriterStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "done"
  | "unavailable";

export interface UseRewriterOptions
  extends Omit<RewriteOptions, "onUpdate" | "signal"> {
  /** Whether to automatically run on mount / input change. Default: `true`. */
  enabled?: boolean;
}

export interface UseRewriterReturn {
  status: RewriterStatus;
  /** Rewritten text (grows during streaming), or `null` while idle / unavailable. */
  output: string | null;
  error: Error | null;
  /** Whether the result was loaded from cache (no model call). */
  fromCache: boolean;
  /** Imperatively dismiss; sets status to `"unavailable"` and clears output. */
  dismiss(): void;
}

/**
 * Auto-run a rewrite on mount and re-run when meaningful inputs change. Pass
 * primitive options inline; non-primitive options (`cache`, `monitor`) should
 * be stable references (memoize if necessary).
 */
export const useRewriter = (options: UseRewriterOptions): UseRewriterReturn => {
  const [status, setStatus] = useState<RewriterStatus>(() =>
    isAvailable() ? "idle" : "unavailable",
  );
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const {
    input,
    context,
    language,
    supportedLanguages,
    tone,
    format,
    length,
    sharedContext,
    monitor,
    cache,
    cacheKey,
    cacheTtl,
    cacheRefresh,
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

    rewrite({
      input,
      context,
      language,
      supportedLanguages,
      tone,
      format,
      length,
      sharedContext,
      monitor,
      cache,
      cacheKey,
      cacheTtl,
      cacheRefresh,
      signal: controller.signal,
      onUpdate: (chunk) => {
        if (controller.signal.aborted) return;
        setOutput(chunk);
        setStatus("streaming");
      },
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
        if (err instanceof RewriterUnavailableError) {
          setStatus("unavailable");
          return;
        }
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("unavailable");
      });

    return () => {
      controller.abort();
    };
  }, [
    enabled,
    input,
    context,
    language,
    supportedLanguages,
    tone,
    format,
    length,
    sharedContext,
    monitor,
    cache,
    cacheKey,
    cacheTtl,
    cacheRefresh,
  ]);

  const dismiss = () => {
    setStatus("unavailable");
    setOutput(null);
  };

  return { status, output, error, fromCache, dismiss };
};

export type {
  CacheOption,
  RewriteCache,
  RewriteOptions,
  RewriteResult,
} from "../index.js";
