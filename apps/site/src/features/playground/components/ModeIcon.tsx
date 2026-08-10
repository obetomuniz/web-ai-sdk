import type { ReactNode, SVGProps } from "react";

interface Props extends SVGProps<SVGSVGElement> {
  modeId: string;
}

/** One glyph per agent mode, used in both the mode trigger and the mode menu. */
export function ModeIcon({ modeId, ...svgProps }: Props) {
  const path = ICONS[modeId] ?? ICONS.minimal;
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...svgProps}>
      {path}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  minimal: (
    <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.4" />
  ),
  "web-ai-suite": (
    <>
      <rect
        x="2.75"
        y="2.75"
        width="7"
        height="7"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="6.25"
        y="6.25"
        width="7"
        height="7"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </>
  ),
  platform: (
    <>
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M2.5 8h11M8 2.25c1.7 1.6 2.65 3.6 2.65 5.75S9.7 12.15 8 13.75c-1.7-1.6-2.65-3.6-2.65-5.75S6.3 3.85 8 2.25Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </>
  ),
  "kitchen-sink": (
    <>
      <rect
        x="2.25"
        y="2.25"
        width="4.75"
        height="4.75"
        rx="1.1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="9"
        y="2.25"
        width="4.75"
        height="4.75"
        rx="1.1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="2.25"
        y="9"
        width="4.75"
        height="4.75"
        rx="1.1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="9"
        y="9"
        width="4.75"
        height="4.75"
        rx="1.1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </>
  ),
};
