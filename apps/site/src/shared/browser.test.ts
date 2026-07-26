import { describe, expect, it } from "vitest";
import { detectBrowser } from "./browser.js";

describe("detectBrowser", () => {
  it.each([
    [
      "Chrome",
      {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
      },
      "chrome",
    ],
    [
      "Edge",
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0",
      },
      "edge",
    ],
    [
      "Safari",
      {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15",
      },
      "other",
    ],
    [
      "Firefox",
      {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0",
      },
      "other",
    ],
    [
      "Chrome on Android",
      {
        userAgent:
          "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/148.0.0.0 Mobile Safari/537.36",
      },
      "other",
    ],
  ])("classifies %s as %s", (_name, navigatorLike, expected) => {
    expect(detectBrowser(navigatorLike)).toBe(expected);
  });
});
