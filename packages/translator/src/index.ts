/**
 * @web-ai-sdk/translator; building block for the Web's Built-in Translator API.
 *
 * Vanilla TypeScript / DOM core. The React adapter at `@web-ai-sdk/translator/react` is a
 * thin hook around this module.
 *
 * Spec: https://developer.chrome.com/docs/ai/translator-api
 */

import {
  type TranslatorAvailability,
  type TranslatorAvailabilityOptions,
  checkAvailability,
  getOrCreateTranslator,
  getTranslatorApi,
  isTranslatorAvailable,
} from "./api.js";
import {
  type BlockSerialization,
  DEFAULT_OPAQUE_INLINE_TAGS,
  buildCasingMap,
  isUntranslatableToken,
  rebuildBlock,
  serializeBlock,
  stripTokens,
} from "./serialize.js";

export {
  isTranslatorAvailable,
  checkAvailability,
  getTranslatorApi,
  getOrCreateTranslator,
  type TranslatorAvailability,
  type TranslatorAvailabilityOptions,
};

export const DEFAULT_ROOT_SELECTOR = "[data-translate-root]";
export const DEFAULT_BLOCK_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, dt, dd, summary";

export type TranslateProgress =
  | { phase: "loading-model" }
  | { phase: "downloading-model"; loaded: number }
  | { phase: "translating"; done: number; total: number }
  | { phase: "block-translated"; block: Element; done: number; total: number }
  | { phase: "block-skipped"; block: Element; reason: SkipReason }
  | { phase: "block-error"; block: Element; error: unknown }
  | { phase: "done"; blocksTranslated: number };

export type SkipReason = "empty" | "all-tokens" | "untranslatable-token";

export type RootsOption =
  | string
  | Element
  | readonly Element[]
  | (() => Iterable<Element>);

export interface TranslateOptions {
  /** BCP-47 source language (e.g. `pt`, `pt-BR`). */
  sourceLanguage: string;
  /** BCP-47 target language. Default: `"en"`. */
  targetLanguage?: string;
  /**
   * Where to look for translatable blocks. Default:
   * `document.querySelectorAll("[data-translate-root]")`.
   */
  roots?: RootsOption;
  /** Block-level CSS selector. Default: standard text blocks. */
  blockSelector?: string;
  /** Tags whose inner text is treated as opaque (cloned wholesale, not translated). */
  opaqueInlineTags?: readonly string[];
  /** Streaming progress events. */
  onProgress?: (event: TranslateProgress) => void;
  /** `Document` to operate on. Default: `globalThis.document`. */
  document?: Document;
}

export interface TranslateController {
  /** Resolves with the count of successfully translated blocks. */
  done: Promise<{ blocksTranslated: number }>;
  /** Abort an in-flight translation. The promise rejects with `AbortError`. */
  cancel(): void;
  /**
   * Restore every block that has been translated so far to its original
   * children. Idempotent; calling twice on the same block is a no-op.
   */
  restore(): void;
  /** Whether any blocks remain in the translated state. */
  isTranslated(): boolean;
}

interface TranslatedRecord {
  block: Element;
  original: Node[];
}

const NORMALIZE_LANG = (lang: string): string =>
  lang.split("-")[0]?.toLowerCase() ?? lang.toLowerCase();

const resolveRoots = (
  roots: RootsOption | undefined,
  doc: Document,
): Element[] => {
  if (roots === undefined) {
    return Array.from(doc.querySelectorAll<Element>(DEFAULT_ROOT_SELECTOR));
  }
  if (typeof roots === "string") {
    return Array.from(doc.querySelectorAll<Element>(roots));
  }
  if (typeof roots === "function") {
    return Array.from(roots());
  }
  if (Array.isArray(roots)) {
    return [...(roots as readonly Element[])];
  }
  return [roots as Element];
};

const findBlocks = (
  roots: readonly Element[],
  blockSelector: string,
): Element[] => {
  const seen = new Set<Element>();
  const blocks: Element[] = [];

  const consider = (el: Element): void => {
    if (seen.has(el)) return;
    if (el.closest("pre")) return;
    if (el.querySelector("pre")) return;
    if (el.querySelector(blockSelector)) return;
    if (!el.textContent?.trim()) return;
    seen.add(el);
    blocks.push(el);
  };

  for (const root of roots) {
    if (root.querySelector(blockSelector)) {
      for (const block of root.querySelectorAll<Element>(blockSelector)) {
        consider(block);
      }
    } else {
      consider(root);
    }
  }

  return blocks;
};

const snapshotChildren = (block: Element): Node[] =>
  Array.from(block.childNodes).map((n) => n.cloneNode(true));

const skipReason = (serialization: BlockSerialization): SkipReason | null => {
  const trimmed = serialization.text.trim();
  if (!trimmed) return "empty";
  const stripped = stripTokens(serialization.text).trim();
  if (!stripped) return "all-tokens";
  const isStandaloneToken =
    serialization.parts.length === 0 && !/\s/.test(trimmed);
  if (isStandaloneToken && isUntranslatableToken(trimmed)) {
    return "untranslatable-token";
  }
  return null;
};

class AbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Translation aborted");
  }
}

/**
 * Start a block-level translation. Returns synchronously with a controller;
 * await `controller.done` for completion or call `controller.cancel()` /
 * `controller.restore()` at any time. On unsupported browsers, `done`
 * resolves immediately with `blocksTranslated: 0`.
 */
export const translate = (options: TranslateOptions): TranslateController => {
  const doc = options.document ?? globalThis.document;
  const targetLanguage = options.targetLanguage ?? "en";
  const blockSelector = options.blockSelector ?? DEFAULT_BLOCK_SELECTOR;
  const opaqueTags = new Set(
    (options.opaqueInlineTags ?? DEFAULT_OPAQUE_INLINE_TAGS).map((t) =>
      t.toUpperCase(),
    ),
  );
  const onProgress = options.onProgress ?? (() => {});

  const sourceShort = NORMALIZE_LANG(options.sourceLanguage);
  const targetShort = NORMALIZE_LANG(targetLanguage);
  const sameLanguage = sourceShort === targetShort;

  let cancelled = false;
  const translated: TranslatedRecord[] = [];

  const controller: TranslateController = {
    done: Promise.resolve({ blocksTranslated: 0 }),
    cancel: () => {
      cancelled = true;
    },
    restore: () => {
      cancelled = true;
      while (translated.length > 0) {
        const record = translated.pop();
        if (!record) break;
        record.block.replaceChildren(
          ...record.original.map((n) => n.cloneNode(true)),
        );
      }
    },
    isTranslated: () => translated.length > 0,
  };

  if (sameLanguage || !doc) {
    return controller;
  }

  const api = getTranslatorApi();
  if (!api) {
    return controller;
  }

  controller.done = (async () => {
    const roots = resolveRoots(options.roots, doc);
    const blocks = findBlocks(roots, blockSelector);
    if (blocks.length === 0) {
      onProgress({ phase: "done", blocksTranslated: 0 });
      return { blocksTranslated: 0 };
    }

    onProgress({ phase: "loading-model" });

    const session = await getOrCreateTranslator(api, {
      sourceLanguage: sourceShort,
      targetLanguage: targetShort,
      monitor(m) {
        m.addEventListener("downloadprogress", (event) => {
          onProgress({ phase: "downloading-model", loaded: event.loaded });
        });
      },
    });
    if (cancelled) throw new AbortError();

    const casingMap = new Map<string, string>();
    for (const block of blocks) {
      buildCasingMap(block.textContent ?? "", casingMap);
    }

    onProgress({ phase: "translating", done: 0, total: blocks.length });
    let done = 0;

    for (const block of blocks) {
      if (cancelled) throw new AbortError();

      const serialization = serializeBlock(block, opaqueTags);
      const skip = skipReason(serialization);

      if (skip) {
        onProgress({ phase: "block-skipped", block, reason: skip });
        done += 1;
        onProgress({
          phase: "block-translated",
          block,
          done,
          total: blocks.length,
        });
        continue;
      }

      const original = snapshotChildren(block);
      try {
        const out = await session.translate(serialization.text);
        if (cancelled) throw new AbortError();
        const fragment = rebuildBlock(out, serialization, casingMap, doc);
        block.replaceChildren(fragment);
        translated.push({ block, original });
      } catch (err) {
        if (err instanceof AbortError) throw err;
        onProgress({ phase: "block-error", block, error: err });
      }

      done += 1;
      onProgress({
        phase: "block-translated",
        block,
        done,
        total: blocks.length,
      });
    }

    onProgress({ phase: "done", blocksTranslated: translated.length });
    return { blocksTranslated: translated.length };
  })();

  return controller;
};

export {
  buildCasingMap,
  isUntranslatableToken,
  rebuildBlock,
  restoreOriginalCasing,
  serializeBlock,
  stripTokens,
} from "./serialize.js";
export type { BlockSerialization } from "./serialize.js";
export type {
  TranslatorApi,
  TranslatorInstance,
} from "./api.js";
