export type WebAIBrowser = "chrome" | "edge" | "other";

interface NavigatorWithUserAgentData {
  userAgent: string;
  userAgentData?: {
    brands?: Array<{ brand: string; version: string }>;
  };
}

const MOBILE_USER_AGENT = /Android|iPhone|iPad|iPod|Mobile|Tablet/i;

/**
 * Identify desktop browsers with a known Web AI implementation.
 *
 * Mobile Chrome and Edge use different engines on iOS and do not expose the
 * built-in AI APIs on Android either, so they intentionally resolve to
 * `other` alongside Safari, Firefox, and unsupported Chromium forks.
 */
export function detectBrowser(
  source: NavigatorWithUserAgentData | undefined = getNavigator(),
): WebAIBrowser {
  if (!source || MOBILE_USER_AGENT.test(source.userAgent)) return "other";

  const brands = source.userAgentData?.brands;
  if (brands?.some((brand) => brand.brand === "Microsoft Edge")) {
    return "edge";
  }
  if (brands?.some((brand) => brand.brand === "Google Chrome")) {
    return "chrome";
  }

  if (/\bEdg\//.test(source.userAgent)) return "edge";
  if (/\bChrome\//.test(source.userAgent)) return "chrome";
  return "other";
}

export function isDesktopWebAIBrowser(): boolean {
  return detectBrowser() !== "other";
}

function getNavigator(): NavigatorWithUserAgentData | undefined {
  return typeof navigator === "undefined"
    ? undefined
    : (navigator as NavigatorWithUserAgentData);
}
