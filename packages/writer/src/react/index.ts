import { useEffect, useState } from "react";
import {
  isAvailable,
  type WriteOptions,
  WriterUnavailableError,
  write,
} from "../index.js";

export type WriterStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "done"
  | "unavailable";

export interface UseWriterOptions
  extends Omit<WriteOptions, "onUpdate" | "signal"> {
  /** Whether to automatically run on mount / input change. Default: `true`. */
  enabled?: boolean;
}

export interface UseWriterReturn {
  status: WriterStatus;
  /** Generated text (grows during streaming), or `null` while idle / unavailable. */
  output: string | null;
  error: Error | null;
  /** Whether the result was loaded from cache (no model call). */
  fromCache: boolean;
  /** Imperatively dismiss; sets status to `"unavailable"` and clears output. */
  dismiss(): void;
}

/**
 * Auto-run a writing task on mount and re-run when meaningful inputs change.
 * Pass primitive options inline; non-primitive options (`cache`, `monitor`)
 * should be stable references (memoize if necessary).
 */
export const useWriter = (options: UseWriterOptions): UseWriterReturn => {
  const [status, setStatus] = useState<WriterStatus>(() =>
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

    write({
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
        if (err instanceof WriterUnavailableError) {
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
  WriteCache,
  WriteOptions,
  WriteResult,
} from "../index.js";
