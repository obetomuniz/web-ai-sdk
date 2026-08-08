import { useCallback, useEffect, useState } from "react";

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
