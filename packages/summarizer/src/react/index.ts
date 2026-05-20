import { useEffect, useState } from "react";
import {
  type SummarizeOptions,
  SummarizerUnavailableError,
  isSummarizerAvailable,
  summarize,
} from "../index.js";

export type SummarizerStatus =
  | "pending"
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
  summary: string | null;
  error: Error | null;
  /** Whether the result was loaded from cache (no model call). */
  fromCache: boolean;
  /** Imperatively dismiss; sets status to `"unavailable"` and clears summary. */
  dismiss(): void;
}

/**
 * Auto-run a summarization on mount and re-run when meaningful inputs
 * change. Pass primitive options inline; `article`, `cache`, `sharedContext`,
 * and `createOptions` should be stable references (memoize if necessary).
 */
export const useSummarizer = (
  options: UseSummarizerOptions,
): UseSummarizerReturn => {
  const [status, setStatus] = useState<SummarizerStatus>(() =>
    isSummarizerAvailable() ? "pending" : "unavailable",
  );
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const {
    article,
    text,
    language,
    title,
    description,
    cacheKey,
    cache,
    sharedContext,
    createOptions,
    maxInputChars,
    minSkeletonChars,
    supportedLanguages,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;
    if (!isSummarizerAvailable()) {
      setStatus("unavailable");
      return;
    }

    const controller = new AbortController();
    setError(null);
    setStatus("loading");

    summarize({
      article,
      text,
      language,
      title,
      description,
      cacheKey,
      cache,
      sharedContext,
      createOptions,
      maxInputChars,
      minSkeletonChars,
      supportedLanguages,
      signal: controller.signal,
      onUpdate: (chunk) => {
        if (controller.signal.aborted) return;
        setSummary(chunk);
        setStatus("streaming");
      },
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.summary) {
          setStatus("unavailable");
          return;
        }
        setSummary(result.summary);
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
    article,
    text,
    language,
    title,
    description,
    cacheKey,
    cache,
    sharedContext,
    createOptions,
    maxInputChars,
    minSkeletonChars,
    supportedLanguages,
  ]);

  const dismiss = () => {
    setStatus("unavailable");
    setSummary(null);
  };

  return { status, summary, error, fromCache, dismiss };
};

export type {
  SummarizeOptions,
  SummarizeResult,
  SummaryCache,
} from "../index.js";
