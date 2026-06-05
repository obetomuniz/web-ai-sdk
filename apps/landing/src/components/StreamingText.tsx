import { useEffect, useRef, useState } from "react";

// Underscore cursor that hugs the text: solid while streaming, blinking at rest.
const cursorBase =
  "inline-block h-[2px] w-[0.5em] rounded-[1px] bg-accent align-[-0.15em] ml-[0.06em]";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Streams `text` in on mount like generated output, trailing the brand caret.
 * The caret disappears once finished so it doesn't compete with the wordmark's
 * resting blink. Honors `prefers-reduced-motion` (renders the full text at once).
 */
export function StreamingText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const reduced = prefersReducedMotion();
  const [shown, setShown] = useState(reduced ? text : "");
  const [done, setDone] = useState(reduced);
  const i = useRef(0);

  useEffect(() => {
    if (reduced) {
      setShown(text);
      setDone(true);
      return;
    }
    let timer: number;
    i.current = 0;
    setDone(false);
    const step = () => {
      i.current += 1;
      setShown(text.slice(0, i.current));
      if (i.current < text.length) {
        const prev = text.charAt(i.current - 1);
        // Pause after spaces/punctuation so it reads like token chunks.
        const delay =
          prev === " "
            ? 30
            : /[,.;:]/.test(prev)
              ? 110
              : 9 + Math.random() * 20;
        timer = window.setTimeout(step, delay);
      } else {
        setDone(true);
      }
    };
    step();
    return () => window.clearTimeout(timer);
  }, [text, reduced]);

  // The not-yet-typed remainder is rendered invisibly so the element always
  // occupies its final size; this prevents a layout shift when the text wraps.
  const rest = text.slice(shown.length);

  return (
    <span className={className}>
      {shown}
      <span
        className={done ? `${cursorBase} animate-blink` : cursorBase}
        aria-hidden="true"
      />
      {rest ? (
        <span className="opacity-0" aria-hidden="true">
          {rest}
        </span>
      ) : null}
    </span>
  );
}
