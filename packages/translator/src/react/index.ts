import { useEffect, useState } from "react";
import {
  type TranslateOptions,
  TranslatorUnavailableError,
  isAvailable,
  translate,
} from "../index.js";

export type TranslatorStatus = "idle" | "loading" | "done" | "unavailable";

export interface UseTranslatorOptions extends Omit<TranslateOptions, "signal"> {
  /** Whether to automatically run on mount / option change. Default: `true`. */
  enabled?: boolean;
}

export interface UseTranslatorReturn {
  status: TranslatorStatus;
  /** Translated text, or `null` while idle / unavailable. */
  output: string | null;
  error: Error | null;
  /** Whether the result was loaded from cache (no model call). */
  fromCache: boolean;
}

/**
 * Auto-translate `input` from `sourceLanguage` to `targetLanguage`. Re-runs
 * when any of the inputs change. Stays in `"idle"` until `input` is
 * non-empty and the language pair differs.
 */
export const useTranslator = (
  options: UseTranslatorOptions,
): UseTranslatorReturn => {
  const [status, setStatus] = useState<TranslatorStatus>(() =>
    isAvailable() ? "idle" : "unavailable",
  );
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const {
    input,
    sourceLanguage,
    targetLanguage,
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

    translate({
      input,
      sourceLanguage,
      targetLanguage,
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
        if (err instanceof TranslatorUnavailableError) {
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
    sourceLanguage,
    targetLanguage,
    monitor,
    cache,
    cacheKey,
  ]);

  return { status, output, error, fromCache };
};

export type {
  TranslateOptions,
  TranslateResult,
  TranslationCache,
  CacheOption,
} from "../index.js";
