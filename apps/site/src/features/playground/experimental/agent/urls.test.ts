import { describe, expect, it } from "vitest";
import {
  isContextuallyGroundedUrl,
  normUrl,
  resolveContextualUrls,
} from "./urls.js";

describe("resolveContextualUrls", () => {
  it("uses a direct URL without applying conversational inference", () => {
    expect(
      resolveContextualUrls("Fetch https://api.example.test/items/3", [
        "https://api.example.test/items/2",
      ]),
    ).toEqual(["https://api.example.test/items/3"]);
  });

  it("resolves an explicit sibling resource on a known route", () => {
    expect(
      resolveContextualUrls("now from obetomuniz/obetomuniz", [
        "https://api.github.com/repos/obetomuniz/web-ai-sdk",
      ]),
    ).toEqual(["https://api.github.com/repos/obetomuniz/obetomuniz"]);
  });

  it("rejects ambiguous resource follow-ups", () => {
    expect(
      resolveContextualUrls("now from another repository", [
        "https://api.github.com/repos/obetomuniz/web-ai-sdk",
      ]),
    ).toEqual([]);
  });
});

describe("isContextuallyGroundedUrl", () => {
  const known = new Set([
    normUrl("https://api.github.com/repos/obetomuniz/web-ai-sdk"),
  ]);

  it("accepts a changed resource named explicitly by the user", () => {
    expect(
      isContextuallyGroundedUrl(
        "https://api.github.com/repos/obetomuniz/obetomuniz",
        "now from obetomuniz/obetomuniz",
        known,
      ),
    ).toBe(true);
  });

  it("rejects a model-invented sibling resource", () => {
    expect(
      isContextuallyGroundedUrl(
        "https://api.github.com/repos/obetomuniz/other-project",
        "now from another repo",
        known,
      ),
    ).toBe(false);
  });

  it("rejects an endpoint pivot that only shares an interior segment", () => {
    expect(
      isContextuallyGroundedUrl(
        "https://api.github.com/users/obetomuniz/repos",
        "now from users obetomuniz repos",
        known,
      ),
    ).toBe(false);
  });
});
