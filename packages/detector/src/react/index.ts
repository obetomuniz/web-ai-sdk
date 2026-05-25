import { useEffect, useRef, useState } from "react";
import {
  type DetectOptions,
  type DetectResult,
  type DetectionResult,
  DetectorUnavailableError,
  detect,
  isAvailable,
} from "../index.js";

export type DetectorStatus = "idle" | "loading" | "done" | "unavailable";

export interface UseDetectorOptions
  extends Omit<DetectOptions, "input" | "signal"> {
  /** Text to detect. When falsy / whitespace-only the hook stays `idle`. */
  input: string;
  /** Whether to automatically run on mount / input change. Default: `true`. */
  enabled?: boolean;
}

export interface UseDetectorReturn {
  status: DetectorStatus;
  /**
   * Detection output, or `null` while idle / inconclusive. Mirrors
   * `DetectResult["output"]`.
   */
  output: DetectResult["output"];
  error: Error | null;
  /** Whether the result was loaded from cache (no model call). */
  fromCache: boolean;
}

/**
 * Auto-detect the language of `input`. Re-runs when `input` changes. Stays
 * in `"idle"` until the input is non-empty. Pass `cache` (stable reference)
 * to enable the result cache.
 */
export const useDetector = (options: UseDetectorOptions): UseDetectorReturn => {
  const [status, setStatus] = useState<DetectorStatus>(() =>
    isAvailable() ? "idle" : "unavailable",
  );
  const [output, setOutput] = useState<DetectResult["output"]>(null);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const {
    input,
    expectedInputLanguages,
    minConfidence,
    monitor,
    cache,
    cacheKey,
    enabled = true,
  } = options;

  // Keep the most recent options in a ref so async work that's already in
  // flight reads the latest values when its setters fire.
  const optionsRef = useRef(options);
  optionsRef.current = options;

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

    detect({
      input,
      expectedInputLanguages,
      minConfidence,
      monitor,
      cache,
      cacheKey,
      signal: controller.signal,
    })
      .then((result: DetectResult) => {
        if (controller.signal.aborted) return;
        setOutput(result.output);
        setFromCache(result.cached);
        setStatus("done");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if ((err as { name?: string })?.name === "AbortError") return;
        if (err instanceof DetectorUnavailableError) {
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
    expectedInputLanguages,
    minConfidence,
    monitor,
    cache,
    cacheKey,
  ]);

  return { status, output, error, fromCache };
};

export type {
  DetectOptions,
  DetectResult,
  DetectionResult,
  DetectionCache,
  CacheOption,
} from "../index.js";
