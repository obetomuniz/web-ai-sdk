import { useEffect, useRef, useState } from "react";
import {
  type DetectOptions,
  type DetectResult,
  type DetectionResult,
  DetectorUnavailableError,
  detect,
  isDetectorAvailable,
} from "../index.js";

export type DetectorStatus = "pending" | "loading" | "done" | "unavailable";

export interface UseDetectorOptions
  extends Omit<DetectOptions, "text" | "signal"> {
  /** Text to detect. When falsy / whitespace-only the hook stays `pending`. */
  text: string;
  /** Whether to automatically run on mount / input change. Default: `true`. */
  enabled?: boolean;
}

export interface UseDetectorReturn {
  status: DetectorStatus;
  /** Top language (BCP-47), or `null` while pending / inconclusive. */
  language: string | null;
  /** Confidence of the top result. */
  confidence: number;
  /** Full sorted list of candidates. */
  all: DetectionResult[];
  error: Error | null;
  /** Whether the result was loaded from cache (no model call). */
  fromCache: boolean;
}

/**
 * Auto-detect the language of `text`. Re-runs when `text` changes. Stays in
 * `"pending"` until the input is non-empty. Pass `cache` (stable reference)
 * to enable the result cache.
 */
export const useDetector = (options: UseDetectorOptions): UseDetectorReturn => {
  const [status, setStatus] = useState<DetectorStatus>(() =>
    isDetectorAvailable() ? "pending" : "unavailable",
  );
  const [language, setLanguage] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [all, setAll] = useState<DetectionResult[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const {
    text,
    expectedInputLanguages,
    minConfidence,
    createOptions,
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
    if (!isDetectorAvailable()) {
      setStatus("unavailable");
      return;
    }
    if (!text.trim()) {
      setStatus("pending");
      setLanguage(null);
      setConfidence(0);
      setAll([]);
      return;
    }

    const controller = new AbortController();
    setError(null);
    setStatus("loading");

    detect({
      text,
      expectedInputLanguages,
      minConfidence,
      createOptions,
      cache,
      cacheKey,
      signal: controller.signal,
    })
      .then((result: DetectResult) => {
        if (controller.signal.aborted) return;
        setLanguage(result.language);
        setConfidence(result.confidence);
        setAll(result.all);
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
    text,
    expectedInputLanguages,
    minConfidence,
    createOptions,
    cache,
    cacheKey,
  ]);

  return { status, language, confidence, all, error, fromCache };
};

export type {
  DetectOptions,
  DetectResult,
  DetectionResult,
  DetectionCache,
} from "../index.js";
