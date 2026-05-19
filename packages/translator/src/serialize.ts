/**
 * Block-level serialization for the Translator API: turn a DOM block into a
 * single string with numbered placeholders for inline elements, hand it to the
 * model, then rebuild the block from the translation by reattaching the
 * original elements around the translated text.
 *
 * Inline elements come in two flavors:
 *   - **Paired** (`<x0>...</x0>`): links, <strong>, <em>; the model translates
 *     the inner text; we clone the element shallow and reattach with the
 *     translated text.
 *   - **Opaque** (`<x0/>`): inline <code>, <kbd>, <br>, <img>; the model sees
 *     a self-closing token; we clone the element wholesale on rebuild so its
 *     inner content (e.g. `getElementById`) survives untouched.
 *
 * We never parse the translated string as HTML: every element rendered into
 * the rebuilt block comes from the original DOM. Any surprising markup the
 * model emits ends up as text, in line with the no-`innerHTML` rule.
 */

export const DEFAULT_OPAQUE_INLINE_TAGS: readonly string[] = [
  "CODE",
  "KBD",
  "VAR",
  "SAMP",
  "TT",
  "BR",
  "IMG",
  "WBR",
];

export interface BlockSerialization {
  /** The model-facing string with numbered placeholders. */
  text: string;
  /** Original elements indexed by placeholder number. */
  parts: Array<{ element: Element; paired: boolean }>;
}

const WORD_RE = /[A-Za-z][A-Za-z0-9]*/g;
// `i` flag is load-bearing: some models (notably for ja/zh targets) emit
// `<X0>...</X0>` or even `<X0>...</x0>` instead of the lowercase tag we
// serialized. Backreferences honor the `i` flag, so asymmetric casing parses
// correctly too.
const TOKEN_RE = /<x(\d+)\/>|<x(\d+)>([\s\S]*?)<\/x\2>/gi;

export const serializeBlock = (
  block: Element,
  opaqueTags: ReadonlySet<string>,
): BlockSerialization => {
  const parts: BlockSerialization["parts"] = [];
  let text = "";

  for (const child of Array.from(block.childNodes)) {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      text += child.nodeValue ?? "";
      continue;
    }
    if (child.nodeType !== 1 /* ELEMENT_NODE */) continue;

    const el = child as Element;
    const idx = parts.length;
    const opaque = opaqueTags.has(el.tagName);
    parts.push({ element: el, paired: !opaque });
    if (opaque) {
      text += `<x${idx}/>`;
    } else {
      text += `<x${idx}>${el.textContent ?? ""}</x${idx}>`;
    }
  }

  return { text, parts };
};

/**
 * Map of `lowercased word → first occurrence with its original casing`. Used
 * to restore brand names and acronyms the model decided to up/lowercase.
 */
export const buildCasingMap = (
  text: string,
  map = new Map<string, string>(),
): Map<string, string> => {
  for (const match of text.matchAll(WORD_RE)) {
    const word = match[0];
    const lower = word.toLowerCase();
    if (!map.has(lower)) map.set(lower, word);
  }
  return map;
};

/**
 * Walk the model's output and, for any word that came back in ALL CAPS while
 * the original had mixed/lowercase casing (or vice-versa), swap it back. This
 * catches "StateX → STATEX" and "PWA → pwa" without disturbing legitimate
 * translations whose lowercased form differs from anything in the map.
 */
export const restoreOriginalCasing = (
  text: string,
  casingMap: ReadonlyMap<string, string>,
): string => {
  if (casingMap.size === 0) return text;
  return text.replace(WORD_RE, (token) => {
    // Single-character tokens carry no all-caps signal: a Portuguese
    // sentence-initial "A" looks identical to "ALL CAPS A", and restoring
    // that onto an English lowercase "a" mid-sentence is wrong.
    if (token.length < 2) return token;
    const original = casingMap.get(token.toLowerCase());
    if (!original || original === token || original.length < 2) return token;
    const tokenAllCaps = token === token.toUpperCase();
    const originalAllCaps = original === original.toUpperCase();
    if (tokenAllCaps && !originalAllCaps) return original;
    if (originalAllCaps && !tokenAllCaps) return original;
    return token;
  });
};

/**
 * True for a single token whose casing isn't a regular "Capitalized word"
 * pattern: acronyms ("PWA"), CamelCase ("StateX"), camelCase ("myFunction"),
 * SCREAMING_SNAKE ("API_KEY"). The model has nothing to translate for these
 * and tends to mangle their casing when they appear in isolation.
 */
export const isUntranslatableToken = (text: string): boolean => {
  if (!text || /\s/.test(text)) return false;
  if (!/[A-Z]/.test(text)) return false;
  return !/^[A-Z][a-z]*$/.test(text);
};

export const rebuildBlock = (
  translated: string,
  serialization: BlockSerialization,
  casingMap: ReadonlyMap<string, string>,
  doc: Document,
): DocumentFragment => {
  const fragment = doc.createDocumentFragment();
  let cursor = 0;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null = TOKEN_RE.exec(translated);

  const appendText = (raw: string): void => {
    if (!raw) return;
    fragment.appendChild(
      doc.createTextNode(restoreOriginalCasing(raw, casingMap)),
    );
  };

  while (match !== null) {
    if (match.index > cursor) {
      appendText(translated.slice(cursor, match.index));
    }

    if (match[1] !== undefined) {
      const idx = Number.parseInt(match[1], 10);
      const part = serialization.parts[idx];
      if (part) fragment.appendChild(part.element.cloneNode(true));
    } else if (match[2] !== undefined) {
      const idx = Number.parseInt(match[2], 10);
      const inner = match[3] ?? "";
      const part = serialization.parts[idx];
      if (part) {
        const clone = part.element.cloneNode(false) as Element;
        clone.appendChild(
          doc.createTextNode(restoreOriginalCasing(inner, casingMap)),
        );
        fragment.appendChild(clone);
      }
    }

    cursor = TOKEN_RE.lastIndex;
    match = TOKEN_RE.exec(translated);
  }

  if (cursor < translated.length) {
    appendText(translated.slice(cursor));
  }

  return fragment;
};

/** Strip placeholder tokens; useful when checking if a block is all-tokens. */
export const stripTokens = (text: string): string => text.replace(TOKEN_RE, "");
