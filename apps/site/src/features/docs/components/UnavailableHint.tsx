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
 * Desktop Chrome and Edge implement these APIs but enable them differently
 * (different flags, channels, and versions), so each gets its own instructions.
 * Everything else (Safari, Firefox, and mobile browsers, including Chrome and
 * Edge on iOS/Android, which report as "other") lacks the APIs entirely, so
 * flag steps would mislead; there we say plainly that only desktop Chrome and
 * Edge support them today.
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
        currently run only on desktop Chrome and Edge (mobile browsers,
        including Chrome and Edge on iOS and Android, aren't supported yet).
        Open this page on desktop Chrome or Edge to try the demo.
      </p>
    );
  }
  return (
    <p className="demo-hint demo-hint--warn">
      {browser === "edge" ? edge : chrome}
    </p>
  );
};
