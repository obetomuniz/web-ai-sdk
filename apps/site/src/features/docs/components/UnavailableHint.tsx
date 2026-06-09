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
 * On Chrome / Edge (the engines that implement these APIs) we surface the
 * browser-specific enable steps passed as `children`. On any other engine
 * (Safari, Firefox, ...) the APIs don't exist at all, so flag instructions
 * would be misleading; we say plainly that only Chrome and Edge support them
 * today instead of suggesting a Chrome-only workaround.
 */
export const UnavailableHint = ({
  api,
  children,
}: {
  api: string;
  children: ReactNode;
}) => {
  if (detectBrowser() === "other") {
    return (
      <p className="demo-hint">
        {api} isn't supported in this browser yet. The Web's Built-in AI APIs
        currently ship only in Chrome and Edge. Open this page in one of them to
        try the demo.
      </p>
    );
  }
  return <p className="demo-hint">{children}</p>;
};
