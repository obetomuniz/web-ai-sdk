import { useEffect, useState } from "react";
import { playground as ui } from "../../../shared/ui.js";

const VERBS = [
  "Thinking",
  "Pondering",
  "Mulling",
  "Drafting",
  "Composing",
  "Tinkering",
  "Reflecting",
  "Sparking",
  "Conjuring",
  "Whirring",
  "Brewing",
  "Cogitating",
  "Ruminating",
  "Wondering",
];

const ROTATION_MS = 1700;
const FALLBACK_VERB = "Thinking";

function pickDifferent(current: string): string {
  if (VERBS.length <= 1) return VERBS[0] ?? FALLBACK_VERB;
  let next = current;
  while (next === current) {
    next = VERBS[Math.floor(Math.random() * VERBS.length)] ?? FALLBACK_VERB;
  }
  return next;
}

export function ThinkingIndicator() {
  const [verb, setVerb] = useState(
    () => VERBS[Math.floor(Math.random() * VERBS.length)] ?? FALLBACK_VERB,
  );

  useEffect(() => {
    const id = setInterval(() => {
      setVerb((current) => pickDifferent(current));
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className={ui.thinking}
      role="status"
      aria-live="polite"
      aria-label="Thinking"
    >
      <span key={verb} className={ui.thinkingVerb} aria-hidden="true">
        {verb}
      </span>
      <span className={ui.thinkingDots} aria-hidden="true">
        <span className={ui.thinkingDot} />
        <span className={`${ui.thinkingDot} [animation-delay:120ms]`} />
        <span className={`${ui.thinkingDot} [animation-delay:240ms]`} />
      </span>
    </span>
  );
}
