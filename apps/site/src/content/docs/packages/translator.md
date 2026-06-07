---
title: "@web-ai-sdk/translator"
description: "Building block for the Web's Built-in Translator API (on-demand language packs). Block-level translation with inline placeholder serialization, casing restoration, and a snapshot-based restore."
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/translator/README.md
---

:::note
This page is generated from [`packages/translator/README.md`](https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/translator/README.md) on every build. Edits should go to the README.
:::
Building block for the Web's Built-in [Translator API](https://developer.chrome.com/docs/ai/translator-api) (on-demand language packs). Block-level translation with inline placeholder serialization, casing restoration, and a snapshot-based restore.

## Status

Translator API is stable in Chrome 138+ and Edge 148+ on desktop, with no flag required (per the [Edge Translator API docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/translator-api)). On any other browser this library is a no-op. Your app stays callable, and the controller just resolves with `blocksTranslated: 0`.

## Install

```sh
pnpm add @web-ai-sdk/translator
# or: npm i @web-ai-sdk/translator / bun add @web-ai-sdk/translator
```

The React adapter ships as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## How it works

1. **Find roots.** Default selector is `[data-translate-root]`. The page declares which subtrees are translatable. Override with `roots` (selector / `Element` / array / function).
2. **Find blocks inside each root.** Paragraphs, headings, list items, blockquotes, and anything else that doesn't itself contain another block. Override `blockSelector`.
3. **Serialize each block** to a single string with numbered placeholders for inline children: `<x0>StateX</x0> is a <x1/>` (paired for `<strong>` / `<a>`, self-closing for opaque inline elements like `<code>` / `<kbd>` / `<br>`).
4. **Translate the string** through one cached `Translator.create()` session per language pair.
5. **Rebuild the block** by walking the translation and reattaching the original elements (cloned) around the translated text. Never parses model output as HTML; surprise markup ends up as text. Casing is restored across blocks via a global `lowercased → original` map (`PWA → pwa → PWA`, `StateX → STATEX → StateX`).

## Vanilla TypeScript / DOM

```ts
import { translate } from "@web-ai-sdk/translator";

const controller = translate({
  sourceLanguage: "pt",
  targetLanguage: "en",
  onProgress: (event) => console.log(event),
});

const { blocksTranslated } = await controller.done;

// later, e.g. on "Show original" click
controller.restore();
```

`translate()` returns synchronously with a controller; `controller.done` resolves when every block has been processed.

## React

```tsx
import { useTranslator } from "@web-ai-sdk/translator/react";

export function ReadInEnglish({ sourceLanguage }: { sourceLanguage: string }) {
  const { state, progress, translate, restore } = useTranslator({
    sourceLanguage,
    targetLanguage: "en",
  });

  if (state === "unavailable") return null;
  if (state === "translated") {
    return <button type="button" onClick={restore}>Show original</button>;
  }
  return (
    <button
      type="button"
      onClick={translate}
      disabled={state === "working"}
    >
      {state === "working" ? formatProgress(progress) : "Read in English"}
    </button>
  );
}
```

State machine: `unavailable | idle | working | translated`. `restore()` flips back to `idle`. `progress` exposes `loading-model` / `downloading-model` / `translating` / `block-translated` / `done` events for richer UI.

## API

### `translate(options): TranslateController`

Start a translation run.

```ts
interface TranslateOptions {
  sourceLanguage: string;
  targetLanguage?: string; // default "en"
  roots?: string | Element | readonly Element[] | (() => Iterable<Element>);
  blockSelector?: string; // default block elements
  opaqueInlineTags?: readonly string[]; // CODE, KBD, ... by default
  onProgress?: (event: TranslateProgress) => void;
  document?: Document; // default globalThis.document
}

interface TranslateController {
  done: Promise<{ blocksTranslated: number }>;
  cancel(): void;
  restore(): void;
  isTranslated(): boolean;
}
```

### `isAvailable(): boolean`

Feature-detect helper.

### `checkAvailability({ sourceLanguage, targetLanguage }): Promise<TranslatorAvailability | null>`

Forwards to the spec's `availability()` call. Returns `null` if the global is missing or the call throws.

### Lower-level helpers (advanced)

`serializeBlock`, `rebuildBlock`, `buildCasingMap`, `restoreOriginalCasing`, `isUntranslatableToken`, `stripTokens`, `getTranslatorApi`. Exported so you can compose the pieces (e.g. translate one block at a time, or apply only the casing restoration to a string).

## Markup contract

Mark translatable subtrees with `data-translate-root` (or pass your own `roots` option):

```html
<article data-translate-root>
  <h1>...</h1>
  <p>...</p>
</article>
```

The library walks each root and translates every leaf block inside it. Blocks inside `<pre>` are skipped, and inline `<code>` / `<kbd>` / `<img>` / `<br>` survive untouched.

## License

MIT © Beto Muniz
