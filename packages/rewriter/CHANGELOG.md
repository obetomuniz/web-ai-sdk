# @web-ai-sdk/rewriter

## 0.6.1

### Patch Changes

- bd4c75a: Align public docs with safer result cache keys and availability ordering, isolated prompt one-shot/session readiness semantics, bounded warm session cache controls, and synced package reference pages.

## 0.6.0

## 0.5.2

## 0.5.1

## 0.5.0

### Minor Changes

- 6e5e40f: Add three new building blocks for the Web's Built-in Writing Assistance APIs:
  - `@web-ai-sdk/writer` wraps the `Writer` API: generates new content from a writing task with tone / format / length options, session reuse, streaming, and opt-in result caching.
  - `@web-ai-sdk/rewriter` wraps the `Rewriter` API: revises existing text with tone / length adjustments, session reuse, streaming, and opt-in result caching.
  - `@web-ai-sdk/proofreader` wraps the `Proofreader` API: corrects grammar, spelling, and punctuation, returning the corrected text plus per-issue corrections with offsets.

  All three are re-exported from `@web-ai-sdk/all` (namespaced root and per-package subpaths) and ship a vanilla core plus a React hook subpath (`useWriter`, `useRewriter`, `useProofreader`).
