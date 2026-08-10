const DONUT_RADIUS = 5.5;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/**
 * Minimal donut progress indicator for on-device model downloads, matching
 * the home demos' treatment. Sits inline next to a demo's action row, so a
 * first run that triggers a model download is visibly in progress instead
 * of looking stalled. A custom tooltip carries the detail on hover or focus.
 */
export const DownloadProgress = ({ progress }: { progress: number | null }) => {
  if (progress === null) return null;
  const pct = Math.round(progress * 100);
  const filled = (
    Math.min(Math.max(progress, 0), 1) * DONUT_CIRCUMFERENCE
  ).toFixed(2);
  return (
    // The aria-label on the live region carries the detail for keyboard and
    // screen-reader users; the tooltip is pointer-hover supplementary text.
    <span className="demo-tip-wrap">
      <svg
        width="14"
        height="14"
        viewBox="0 0 15 15"
        role="status"
        aria-label={`Downloading on-device model ${pct}%`}
        className="demo-donut"
      >
        <circle
          cx="7.5"
          cy="7.5"
          r={DONUT_RADIUS}
          fill="none"
          stroke="var(--demo-input-border)"
          strokeWidth="2.5"
        />
        <circle
          cx="7.5"
          cy="7.5"
          r={DONUT_RADIUS}
          fill="none"
          stroke="var(--sl-color-text-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${DONUT_CIRCUMFERENCE.toFixed(2)}`}
          transform="rotate(-90 7.5 7.5)"
        />
      </svg>
      <span className="demo-tooltip">Downloading on-device model {pct}%</span>
    </span>
  );
};
