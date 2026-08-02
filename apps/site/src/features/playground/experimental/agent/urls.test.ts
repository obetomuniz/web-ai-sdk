import { describe, expect, it } from "vitest";
import {
  extractUrls,
  isContextuallyGroundedUrl,
  normUrl,
  resolveContextualUrls,
} from "./urls.js";

describe("extractUrls", () => {
  it("strips prose punctuation and unmatched closing parentheses", () => {
    expect(
      extractUrls(
        "Fetch https://example.test/one, https://example.test/two.; and (https://example.test/three).",
      ),
    ).toEqual([
      "https://example.test/one",
      "https://example.test/two",
      "https://example.test/three",
    ]);
  });

  it("preserves URL punctuation, balanced parentheses, and percent encoding", () => {
    expect(
      extractUrls(
        "Compare https://example.test/a;b,c?items=1,2#part;two with https://example.test/wiki/Function_(mathematics). Keep https://example.test/encoded%29.",
      ),
    ).toEqual([
      "https://example.test/a;b,c?items=1,2#part;two",
      "https://example.test/wiki/Function_(mathematics)",
      "https://example.test/encoded%29",
    ]);
  });

  it("deduplicates canonical URLs", () => {
    expect(
      extractUrls(
        "Fetch https://example.test/item, then https://example.test/item.",
      ),
    ).toEqual(["https://example.test/item"]);
  });
});

describe("normUrl", () => {
  it("uses the same punctuation rules as direct URL extraction", () => {
    expect(normUrl("https://example.test/wiki/Function_(mathematics).")).toBe(
      "https://example.test/wiki/Function_(mathematics)",
    );
    expect(normUrl("https://example.test/item);")).toBe(
      "https://example.test/item",
    );
  });
});

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
