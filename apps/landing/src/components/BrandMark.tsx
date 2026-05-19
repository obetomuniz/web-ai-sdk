/**
 * The web-ai-sdk brand mark — angle brackets around a stylised "ai" with a
 * flame i-tittle. Geometry mirrors `apps/docs/internal/visual-identity.html`
 * exactly; do not adjust without updating that source of truth.
 *
 * Background is transparent; strokes use `currentColor`, so the parent's CSS
 * `color` controls the mark tint. The flame dot defaults to the canonical
 * brand orange but can be overridden by setting `--brand-mark-accent` on a
 * parent — e.g. the watermark sets it to `currentColor` so the dot fades
 * with the rest of the mark instead of popping as the only saturated pixel.
 *
 * The viewBox is 3:2 (96×64). For square contexts (favicons) we pad in a
 * separate file; in flowing layouts the natural 3:2 ratio is preferred.
 */
export const BrandMark = ({
  className,
  title = "web-ai-sdk",
}: {
  className?: string;
  title?: string;
}) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 96 64"
    role="img"
    aria-label={title}
    fill="none"
    stroke="currentColor"
    strokeWidth="5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 27 L14 38 L22 49" />
    <circle cx="45" cy="38" r="11" />
    <line x1="56" y1="27" x2="56" y2="49" />
    <circle
      cx="56"
      cy="18"
      r="3.8"
      fill="var(--brand-mark-accent, #F26B3B)"
      stroke="none"
    />
    <path d="M68 27 L76 38 L68 49" />
  </svg>
);
