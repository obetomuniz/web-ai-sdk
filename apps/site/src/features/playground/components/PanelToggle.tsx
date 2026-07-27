import { playground as ui } from "../../../shared/ui.js";

interface Props {
  side: "left" | "right";
  open: boolean;
  onClick: () => void;
}

export function PanelToggle({ side, open, onClick }: Props) {
  const panel = side === "left" ? "conversations" : "runtime";
  const action = open ? "Hide" : "Show";
  return (
    <button
      type="button"
      className={ui.panelToggle}
      onClick={(event) => {
        if (open) event.currentTarget.blur();
        onClick();
      }}
      aria-label={`${action} ${panel} panel`}
      title={`${action} ${panel} panel`}
    >
      <svg
        className={ui.panelToggleIcon}
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="2.25"
          y="2.75"
          width="13.5"
          height="12.5"
          rx="2.25"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <path
          d={side === "left" ? "M6.5 3.25v11.5" : "M11.5 3.25v11.5"}
          stroke="currentColor"
          strokeWidth="1.25"
        />
      </svg>
    </button>
  );
}
