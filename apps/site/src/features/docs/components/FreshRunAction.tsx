/**
 * Icon-only fresh-generation control for docs demos, shown once a run has
 * completed. Mirrors the home demos' treatment: a borderless rotate icon
 * with a custom hover/focus tooltip.
 */
export const FreshRunAction = ({
  show,
  onClick,
  tooltipSide = "left",
}: {
  show: boolean;
  onClick: () => void;
  tooltipSide?: "left" | "right";
}) => {
  if (!show) return null;
  return (
    <span className="demo-tip-wrap">
      <button
        type="button"
        className="demo-icon-button"
        onClick={onClick}
        aria-label="Fresh run"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      </button>
      <span
        className={`demo-tooltip ${tooltipSide === "right" ? "demo-tooltip--right" : ""}`}
      >
        Skip the cached result and run the model again
      </span>
    </span>
  );
};
