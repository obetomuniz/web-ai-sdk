import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPAQUE_INLINE_TAGS,
  buildCasingMap,
  isUntranslatableToken,
  rebuildBlock,
  restoreOriginalCasing,
  serializeBlock,
  stripTokens,
} from "./serialize.js";

const OPAQUE = new Set(DEFAULT_OPAQUE_INLINE_TAGS);

const html = (markup: string): Element => {
  const div = document.createElement("div");
  div.innerHTML = markup;
  return div.firstElementChild ?? div;
};

describe("serializeBlock", () => {
  it("replaces paired inline elements with numbered placeholders", () => {
    const block = html(
      '<p>Hello <strong>world</strong>, this is <a href="/x">a link</a>.</p>',
    );
    const { text, parts } = serializeBlock(block, OPAQUE);
    expect(text).toBe("Hello <x0>world</x0>, this is <x1>a link</x1>.");
    expect(parts).toHaveLength(2);
    expect(parts[0]?.paired).toBe(true);
    expect(parts[1]?.paired).toBe(true);
  });

  it("emits self-closing placeholders for opaque inline tags", () => {
    const block = html(
      "<p>Use <code>getElementById</code> or a <kbd>Ctrl+K</kbd> shortcut.</p>",
    );
    const { text, parts } = serializeBlock(block, OPAQUE);
    expect(text).toBe("Use <x0/> or a <x1/> shortcut.");
    expect(parts.every((p) => !p.paired)).toBe(true);
  });

  it("preserves text content of paired children verbatim in the placeholder", () => {
    const block = html("<p><strong>StateX</strong> is a state container.</p>");
    const { text } = serializeBlock(block, OPAQUE);
    expect(text).toBe("<x0>StateX</x0> is a state container.");
  });

  it("ignores non-element non-text nodes", () => {
    const block = html("<p>before<!-- comment -->after</p>");
    const { text, parts } = serializeBlock(block, OPAQUE);
    expect(text).toBe("beforeafter");
    expect(parts).toHaveLength(0);
  });
});

describe("buildCasingMap", () => {
  it("captures the first occurrence's casing per lowercased word", () => {
    const map = buildCasingMap("PWA, then pwa, then PWA again");
    expect(map.get("pwa")).toBe("PWA");
  });

  it("merges across multiple calls", () => {
    const map = buildCasingMap("StateX is great");
    buildCasingMap("statex is also good", map);
    expect(map.get("statex")).toBe("StateX");
  });

  it("matches alphanumeric tokens, not punctuation", () => {
    const map = buildCasingMap("API_KEY: getById");
    expect([...map.keys()].sort()).toEqual(["api", "getbyid", "key"]);
  });
});

describe("restoreOriginalCasing", () => {
  it("uppercases acronyms the model lowercased", () => {
    const map = buildCasingMap("PWA é uma sigla.");
    const out = restoreOriginalCasing("pwa is an acronym.", map);
    expect(out).toBe("PWA is an acronym.");
  });

  it("preserves CamelCase brand names the model uppercased", () => {
    const map = buildCasingMap("StateX é um container.");
    const out = restoreOriginalCasing("STATEX is a container.", map);
    expect(out).toBe("StateX is a container.");
  });

  it("does not touch tokens that already match the original casing", () => {
    const map = buildCasingMap("Hello world");
    const out = restoreOriginalCasing("Hello world", map);
    expect(out).toBe("Hello world");
  });

  it("does not touch unknown tokens", () => {
    const map = buildCasingMap("PWA");
    const out = restoreOriginalCasing("Olá mundo PWA", map);
    expect(out).toBe("Olá mundo PWA");
  });

  it("is a no-op with an empty map", () => {
    const map = new Map<string, string>();
    expect(restoreOriginalCasing("ANY tEXt", map)).toBe("ANY tEXt");
  });

  it("does not restore casing for single-character tokens", () => {
    // PT sentence-initial "A" must not bleed into a mid-sentence English "a".
    const map = buildCasingMap("A linda manhã");
    const out = restoreOriginalCasing("a beautiful morning", map);
    expect(out).toBe("a beautiful morning");
  });

  it("does not restore mid-sentence 'a' to 'A' just because the source had a leading 'A'", () => {
    const map = buildCasingMap(
      "Uma Progressive Web App é um conjunto de práticas. A StateX é uma biblioteca.",
    );
    const out = restoreOriginalCasing(
      "A Progressive Web App is a set of practices.",
      map,
    );
    expect(out).toBe("A Progressive Web App is a set of practices.");
  });
});

describe("isUntranslatableToken", () => {
  it("flags acronyms", () => {
    expect(isUntranslatableToken("PWA")).toBe(true);
    expect(isUntranslatableToken("API")).toBe(true);
  });

  it("flags CamelCase / camelCase / SCREAMING_SNAKE", () => {
    expect(isUntranslatableToken("StateX")).toBe(true);
    expect(isUntranslatableToken("getElementById")).toBe(true);
    expect(isUntranslatableToken("API_KEY")).toBe(true);
  });

  it("does not flag regular ASCII Capitalized words", () => {
    expect(isUntranslatableToken("Hello")).toBe(false);
    expect(isUntranslatableToken("World")).toBe(false);
  });

  it("does not flag multi-word strings", () => {
    expect(isUntranslatableToken("Hello world")).toBe(false);
  });

  it("does not flag all-lowercase", () => {
    expect(isUntranslatableToken("translate")).toBe(false);
  });
});

describe("stripTokens", () => {
  it("removes paired and self-closing placeholders", () => {
    expect(stripTokens("Hi <x0>there</x0> <x1/>!")).toBe("Hi  !");
  });
});

describe("rebuildBlock", () => {
  it("reattaches paired elements with translated inner text", () => {
    const block = html(
      '<p>Hello <strong>world</strong>, this is <a href="/x">a link</a>.</p>',
    );
    const serialization = serializeBlock(block, OPAQUE);
    const map = buildCasingMap(block.textContent ?? "");
    const fragment = rebuildBlock(
      "Olá <x0>mundo</x0>, este é <x1>um link</x1>.",
      serialization,
      map,
      document,
    );
    const wrapper = document.createElement("div");
    wrapper.appendChild(fragment);
    const a = wrapper.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/x");
    expect(a?.textContent).toBe("um link");
    expect(wrapper.querySelector("strong")?.textContent).toBe("mundo");
    expect(wrapper.textContent).toBe("Olá mundo, este é um link.");
  });

  it("clones opaque elements wholesale, preserving their inner content", () => {
    const block = html("<p>Use <code>getElementById</code> here.</p>");
    const serialization = serializeBlock(block, OPAQUE);
    const map = buildCasingMap(block.textContent ?? "");
    const fragment = rebuildBlock(
      "Use <x0/> aqui.",
      serialization,
      map,
      document,
    );
    const wrapper = document.createElement("div");
    wrapper.appendChild(fragment);
    expect(wrapper.querySelector("code")?.textContent).toBe("getElementById");
    expect(wrapper.textContent).toBe("Use getElementById aqui.");
  });

  it("treats unrecognized markup in the model output as plain text", () => {
    const block = html("<p>Hi <strong>there</strong>.</p>");
    const serialization = serializeBlock(block, OPAQUE);
    const map = buildCasingMap(block.textContent ?? "");
    const fragment = rebuildBlock(
      "Olá <script>alert(1)</script> <x0>amigo</x0>.",
      serialization,
      map,
      document,
    );
    const wrapper = document.createElement("div");
    wrapper.appendChild(fragment);
    expect(wrapper.querySelector("script")).toBeNull();
    expect(wrapper.textContent).toContain("<script>alert(1)</script>");
    expect(wrapper.querySelector("strong")?.textContent).toBe("amigo");
  });

  it("parses placeholders even when the model uppercases the tag", () => {
    // Some Gemini Nano targets (notably ja) emit <X0>...</X0> in place of the
    // lowercase <x0>...</x0> we serialized. We need to recognize both.
    const block = html("<p>Hello <strong>world</strong>.</p>");
    const serialization = serializeBlock(block, OPAQUE);
    const map = buildCasingMap(block.textContent ?? "");
    const fragment = rebuildBlock(
      "こんにちは <X0>世界</X0>。",
      serialization,
      map,
      document,
    );
    const wrapper = document.createElement("div");
    wrapper.appendChild(fragment);
    expect(wrapper.querySelector("strong")?.textContent).toBe("世界");
    expect(wrapper.textContent).toBe("こんにちは 世界。");
  });

  it("parses placeholders with asymmetric tag casing (open upper, close lower)", () => {
    const block = html("<p>Hello <strong>world</strong>.</p>");
    const serialization = serializeBlock(block, OPAQUE);
    const map = buildCasingMap(block.textContent ?? "");
    const fragment = rebuildBlock(
      "Hi <X0>friend</x0>!",
      serialization,
      map,
      document,
    );
    const wrapper = document.createElement("div");
    wrapper.appendChild(fragment);
    expect(wrapper.querySelector("strong")?.textContent).toBe("friend");
    expect(wrapper.textContent).toBe("Hi friend!");
  });

  it("parses self-closing placeholders even when the X is uppercased", () => {
    const block = html("<p>Use <code>getElementById</code> here.</p>");
    const serialization = serializeBlock(block, OPAQUE);
    const map = buildCasingMap(block.textContent ?? "");
    const fragment = rebuildBlock(
      "ここで <X0/> を使ってください。",
      serialization,
      map,
      document,
    );
    const wrapper = document.createElement("div");
    wrapper.appendChild(fragment);
    expect(wrapper.querySelector("code")?.textContent).toBe("getElementById");
  });

  it("restores original casing in translated text and inside paired elements", () => {
    const block = html("<p><strong>StateX</strong> rocks. PWA too.</p>");
    const serialization = serializeBlock(block, OPAQUE);
    const map = buildCasingMap(block.textContent ?? "");
    const fragment = rebuildBlock(
      "<x0>STATEX</x0> arrasa. pwa também.",
      serialization,
      map,
      document,
    );
    const wrapper = document.createElement("div");
    wrapper.appendChild(fragment);
    expect(wrapper.querySelector("strong")?.textContent).toBe("StateX");
    expect(wrapper.textContent).toContain("PWA");
  });

  it("ignores token references with out-of-range indices", () => {
    const serialization = serializeBlock(html("<p>plain</p>"), OPAQUE);
    const map = new Map<string, string>();
    const fragment = rebuildBlock(
      "Hi <x99>nobody</x99>.",
      serialization,
      map,
      document,
    );
    const wrapper = document.createElement("div");
    wrapper.appendChild(fragment);
    expect(wrapper.textContent).toBe("Hi .");
  });
});
