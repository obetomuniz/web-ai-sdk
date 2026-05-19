import { useCallback, useEffect, useRef, useState } from "react";
import {
  type RootsOption,
  type TranslateController,
  type TranslateProgress,
  checkAvailability,
  isTranslatorAvailable,
  translate,
} from "../index.js";

export type TranslatorState = "unavailable" | "idle" | "working" | "translated";

export interface UseTranslatorOptions {
  sourceLanguage: string;
  targetLanguage?: string;
  roots?: RootsOption;
  blockSelector?: string;
  opaqueInlineTags?: readonly string[];
}

export interface UseTranslatorReturn {
  state: TranslatorState;
  /** Latest progress event, or `null` while idle. */
  progress: TranslateProgress | null;
  /** Last error thrown by `translate()`, or `null`. */
  error: Error | null;
  /** Trigger a translation run. No-op while `state === "working"`. */
  translate(): void;
  /** Restore translated blocks. No-op when nothing has been translated. */
  restore(): void;
}

const NORMALIZE_LANG = (lang: string): string =>
  lang.split("-")[0]?.toLowerCase() ?? lang.toLowerCase();

export const useTranslator = (
  options: UseTranslatorOptions,
): UseTranslatorReturn => {
  const {
    sourceLanguage,
    targetLanguage = "en",
    roots,
    blockSelector,
    opaqueInlineTags,
  } = options;

  const sourceShort = NORMALIZE_LANG(sourceLanguage);
  const targetShort = NORMALIZE_LANG(targetLanguage);
  const sameLanguage = sourceShort === targetShort;

  const [state, setState] = useState<TranslatorState>(() => {
    if (sameLanguage) return "unavailable";
    return isTranslatorAvailable() ? "idle" : "unavailable";
  });
  const [progress, setProgress] = useState<TranslateProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const controllerRef = useRef<TranslateController | null>(null);

  useEffect(() => {
    if (sameLanguage) return;
    if (!isTranslatorAvailable()) {
      setState("unavailable");
      return;
    }

    let active = true;
    checkAvailability({
      sourceLanguage: sourceShort,
      targetLanguage: targetShort,
    }).then((availability) => {
      if (!active) return;
      if (availability === "unavailable") setState("unavailable");
    });

    return () => {
      active = false;
    };
  }, [sourceShort, targetShort, sameLanguage]);

  useEffect(() => {
    return () => {
      controllerRef.current?.cancel();
    };
  }, []);

  const triggerTranslate = useCallback(() => {
    if (sameLanguage) return;
    setError(null);
    const controller = translate({
      sourceLanguage: sourceShort,
      targetLanguage: targetShort,
      roots,
      blockSelector,
      opaqueInlineTags,
      onProgress: setProgress,
    });
    controllerRef.current = controller;
    setState("working");

    controller.done
      .then(({ blocksTranslated }) => {
        if (controllerRef.current !== controller) return;
        if (blocksTranslated === 0) {
          setState("idle");
          return;
        }
        setState("translated");
      })
      .catch((err: unknown) => {
        if (controllerRef.current !== controller) return;
        if ((err as { name?: string })?.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setState("idle");
      });
  }, [
    sameLanguage,
    sourceShort,
    targetShort,
    roots,
    blockSelector,
    opaqueInlineTags,
  ]);

  const restore = useCallback(() => {
    controllerRef.current?.restore();
    controllerRef.current = null;
    setState("idle");
    setProgress(null);
  }, []);

  return {
    state,
    progress,
    error,
    translate: triggerTranslate,
    restore,
  };
};

export type {
  RootsOption,
  TranslateController,
  TranslateProgress,
} from "../index.js";
