import type { ReactNode } from "react";

const detectBrowser = (): "chrome" | "edge" | "other" => {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/\bEdg\//.test(ua)) return "edge";
  if (/\bChrome\//.test(ua)) return "chrome";
  return "other";
};

/**
 * Hint shown when a demo's underlying Built-in AI API is unavailable.
 *
 * Chrome and Edge implement these APIs but enable them differently (different
 * flags, channels, and versions), so each gets its own instructions. Every
 * other engine (Safari, Firefox, ...) lacks the APIs entirely, so flag steps
 * would mislead; there we say plainly that only Chrome and Edge support them
 * today.
 */
export const UnavailableHint = ({
  api,
  chrome,
  edge,
}: {
  api: string;
  chrome: ReactNode;
  edge: ReactNode;
}) => {
  const browser = detectBrowser();
  if (browser === "other") {
    return (
      <p className="demo-hint demo-hint--warn">
        {api} isn't supported in this browser yet. The Web's Built-in AI APIs
        currently ship only in Chrome and Edge. Open this page in one of them to
        try the demo.
      </p>
    );
  }
  return (
    <p className="demo-hint demo-hint--warn">
      {browser === "edge" ? edge : chrome}
    </p>
  );
};
