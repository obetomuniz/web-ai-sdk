/**
 * Smart autoscroll for streaming views (chat transcript, agent transcript,
 * event log). Pins the scroll container to the bottom only while the user
 * is already there. The moment they scroll up it yields and stops fighting
 * them, and it resumes automatically as soon as they scroll back to the
 * bottom - so they can read earlier content mid-stream without the view
 * yanking them down on every token.
 *
 * Pass the streaming value(s) in `deps` (e.g. `[messages]`, or
 * `[text, events.length]`) so the view follows each update. One animation
 * frame loop tracks the latest scroll height instead of restarting native
 * smooth scrolling for every chunk.
 *
 * Returns `{ isPinned, scrollToBottom }` so any consumer can reflect the
 * follow state (e.g. show a "jump to latest" pill) and re-pin imperatively.
 * Native APIs only (scroll/wheel/key/touch events + `scrollTo`); reuse it
 * anywhere a container should follow appended content.
 */

import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const NEAR_BOTTOM_PX = 80;
const FOLLOW_EPSILON_PX = 0.5;
const FOLLOW_EASING = 0.32;

export interface StickToBottom {
  /** True while the view follows the bottom; false once the user scrolls up. */
  isPinned: boolean;
  /** Re-pin and scroll to the latest content (smooth by default). */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

export function useStickToBottom<T extends HTMLElement>(
  ref: RefObject<T | null>,
  deps: ReadonlyArray<unknown> = [],
  nearBottomPx: number = NEAR_BOTTOM_PX,
): StickToBottom {
  // `pinnedRef` is the source of truth read by the synchronous pin path
  // (no stale closures). `isPinned` mirrors it for rendering. Default to
  // "pinned" so the first content lands at the bottom before any scroll.
  const pinnedRef = useRef(true);
  const [isPinned, setIsPinned] = useState(true);
  const followFrameRef = useRef<number | null>(null);
  const programmaticFollowRef = useRef(false);

  const cancelFollow = useCallback(() => {
    if (followFrameRef.current !== null) {
      cancelAnimationFrame(followFrameRef.current);
      followFrameRef.current = null;
    }
    programmaticFollowRef.current = false;
  }, []);

  const setPinned = useCallback(
    (next: boolean) => {
      pinnedRef.current = next;
      setIsPinned((prev) => (prev === next ? prev : next));
      if (!next) cancelFollow();
    },
    [cancelFollow],
  );

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = ref.current;
      if (!el) return;
      cancelFollow();
      setPinned(true);
      el.scrollTo({ top: el.scrollHeight, behavior });
    },
    [cancelFollow, ref, setPinned],
  );

  const followBottom = useCallback(() => {
    const el = ref.current;
    if (!el || !pinnedRef.current || followFrameRef.current !== null) {
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) {
      el.scrollTop = el.scrollHeight;
      return;
    }

    programmaticFollowRef.current = true;
    const tick = () => {
      const current = ref.current;
      if (!current || !pinnedRef.current) {
        followFrameRef.current = null;
        programmaticFollowRef.current = false;
        return;
      }

      const target = Math.max(0, current.scrollHeight - current.clientHeight);
      const distance = target - current.scrollTop;
      if (Math.abs(distance) <= FOLLOW_EPSILON_PX) {
        current.scrollTop = target;
        followFrameRef.current = null;
        programmaticFollowRef.current = false;
        return;
      }

      current.scrollTop += distance * FOLLOW_EASING;
      followFrameRef.current = requestAnimationFrame(tick);
    };

    followFrameRef.current = requestAnimationFrame(tick);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Only a container with meaningful overflow can be "scrolled away from
    // the bottom". When content fits, there's nothing to follow and nothing
    // to jump back to - stay pinned so no "jump to latest" affordance shows.
    const canScroll = () => el.scrollHeight - el.clientHeight > nearBottomPx;

    let lastTop = el.scrollTop;
    let lastHeight = el.scrollHeight;

    const onScroll = () => {
      const top = el.scrollTop;
      const height = el.scrollHeight;
      const movedUp = top < lastTop;
      // A shrinking container (collapsed tool card, reset) clamps scrollTop
      // downward without any user gesture - that's not an intent to leave
      // the bottom, so ignore the delta when the height changed.
      const heightChanged = height !== lastHeight;
      lastTop = top;
      lastHeight = height;

      if (!canScroll()) {
        setPinned(true);
        return;
      }
      const dist = height - top - el.clientHeight;
      if (movedUp && !heightChanged && !programmaticFollowRef.current) {
        // User scrolled up (wheel, drag, keys, touch) - yield immediately,
        // even inside the bottom zone, so scrolling up stays smooth instead
        // of being yanked back by the next streamed token.
        setPinned(false);
      } else if (dist <= nearBottomPx) {
        // Scrolled back to the bottom - resume following new content.
        setPinned(true);
      }
    };

    // Wheel / touch / keyboard give us the user's upward intent a beat before
    // the scroll event lands, so a programmatic pin from the next streamed
    // token can't win the race and pull them back down mid-read. Guard on
    // `canScroll` so a stray gesture over a short, non-scrollable view never
    // strands the "jump to latest" button.
    const intentUp = () => {
      if (canScroll()) setPinned(false);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) intentUp();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Home") {
        intentUp();
      }
    };
    let lastTouchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      lastTouchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      if (y > lastTouchY + 2) intentUp();
      lastTouchY = y;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [ref, nearBottomPx, setPinned]);

  useEffect(() => cancelFollow, [cancelFollow]);

  // Keep one animation alive while streamed content grows. Updating its target
  // avoids restarting native smooth scrolling for every token batch, while
  // easing line-height changes prevents the transcript from appearing to blink.
  useLayoutEffect(() => {
    if (!pinnedRef.current) return;
    followBottom();
  }, [followBottom, ...deps]);

  return { isPinned, scrollToBottom };
}
