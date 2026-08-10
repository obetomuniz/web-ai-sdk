import { useCallback, useEffect, useRef, useState } from "react";

/** Shape shared by every `prepare*()` lease across the SDK packages. */
export interface CapabilityLease {
  ready: Promise<void>;
  release(): void;
}

/**
 * Track demo intent. `external` carries an upstream signal (for example an
 * explicit package-tab selection); `markInteracted` records direct
 * interaction inside the demo (focus or pointer). `intent` is true when
 * either signal fired. `interacted` stays limited to direct interaction so
 * demos can prepare on intent but only run after the user touches them.
 */
export const useDemoIntent = (external?: boolean) => {
  const [interacted, setInteracted] = useState(false);
  const markInteracted = useCallback(() => setInteracted(true), []);
  return {
    intent: Boolean(external) || interacted,
    interacted,
    markInteracted,
  };
};

/**
 * Hold a prepared-session lease while `intent` is true. Acquires through
 * `createLease` on the first intent signal and releases on unmount or when
 * `createLease` changes identity (new session options). Keep `createLease`
 * stable with `useCallback` so option edits, not renders, recycle the lease.
 * `ready` rejections are swallowed here because unavailability already
 * surfaces through each demo's availability probe and run path.
 */
export const useCapabilityLease = (
  intent: boolean,
  createLease: () => CapabilityLease,
): void => {
  useEffect(() => {
    if (!intent) return;
    const lease = createLease();
    lease.ready.catch(() => {});
    return () => lease.release();
  }, [intent, createLease]);
};

interface DownloadProgressEvent extends Event {
  readonly loaded: number;
}
interface CreateMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

/**
 * Wire a Built-in AI `monitor` callback to React state. Returns the
 * monitor function to pass into `createOptions.monitor`, plus the current
 * progress (a fraction from 0..1) or `null` when no download is in flight.
 * Warm-model creations emit `downloadprogress` with loaded 0 and 1 only;
 * those events are ignored so the indicator surfaces for real downloads.
 */
export const useDownloadMonitor = () => {
  const [progress, setProgress] = useState<number | null>(null);
  // Tracked outside React state so completion can schedule its clear timer
  // without side effects inside a state updater.
  const visibleRef = useRef(false);

  const monitor = useCallback((m: CreateMonitor) => {
    m.addEventListener("downloadprogress", (e) => {
      if (e.loaded <= 0) return;
      if (e.loaded >= 1) {
        // Settle to "complete" briefly, then clear; stay hidden when no
        // fractional progress ever showed (warm start).
        if (!visibleRef.current) return;
        visibleRef.current = false;
        setProgress(1);
        setTimeout(() => setProgress(null), 900);
        return;
      }
      visibleRef.current = true;
      setProgress(e.loaded);
    });
  }, []);

  const clear = useCallback(() => {
    visibleRef.current = false;
    setProgress(null);
  }, []);

  return { progress, monitor, clear };
};

/**
 * Return `value` after it has stayed unchanged for `delayMs`. Demos use this
 * to run inference after a typing pause instead of on every keystroke.
 */
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};
