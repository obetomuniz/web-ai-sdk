import { useEffect, useState } from "react";
import {
  isAvailable,
  type SummarizeOptions,
  SummarizerUnavailableError,
  summarize,
} from "../index.js";

export type SummarizerStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "done"
  | "unavailable";

export interface UseSummarizerOptions
  extends Omit<SummarizeOptions, "onUpdate" | "signal"> {
  /** Whether to automatically run on mount. Default: `true`. */
  enabled?: boolean;
}

export interface UseSummarizerReturn {
  status: SummarizerStatus;
  /** Final summary text (cleaned), or `null` while idle / unavailable. */
  output: string | null;
  error: Error | null;
  /** Whether the result was loaded from cache (no model call). */
  fromCache: boolean;
  /** Imperatively dismiss; sets status to `"unavailable"` and clears output. */
  dismiss(): void;
}

/**
 * Auto-run a summarization on mount and re-run when meaningful inputs
 * change. Pass primitive options inline; non-primitive options (`cache`,
 * `monitor`) should be stable references (memoize if necessary).
 */
export const useSummarizer = (
  options: UseSummarizerOptions,
): UseSummarizerReturn => {
  const [status, setStatus] = useState<SummarizerStatus>(() =>
    isAvailable() ? "idle" : "unavailable",
  );
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const {
    input,
    language,
    supportedLanguages,
    type,
    length,
    format,
    preference,
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

    summarize({
      input,
      language,
      supportedLanguages,
      type,
      length,
      format,
      preference,
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
        if (err instanceof SummarizerUnavailableError) {
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
    language,
    supportedLanguages,
    type,
    length,
    format,
    preference,
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
  SummarizeOptions,
  SummarizeResult,
  SummaryCache,
} from "../index.js";
