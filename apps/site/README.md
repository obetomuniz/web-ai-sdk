# Site

Astro site for `web-ai-sdk`. It contains the home page, Starlight docs at
`/docs/`, the Playground, and live React demos.

```sh
pnpm build:packages
pnpm site # http://localhost:5173
```

Build packages first because the demos import their generated output.

## Styling

Follow the root [`DESIGN.md`](../../DESIGN.md).

The home page uses Tailwind CSS v4:

- Add shared patterns to `src/shared/ui.ts` first.
- Keep `src/styles/home.css` limited to tokens, layout variables, keyframes, and
  base resets.
- Use local Tailwind utilities only for one-off layout details.
- Use mutually exclusive class sets for conflicting states.
- Use inline styles only for dynamic values that Tailwind cannot know.
- Do not add component stylesheets or static `<style>` blocks to home React
  components.
- Consolidate nearby legacy utility strings when editing a mixed component.

Docs styles live under `src/features/docs/styles/`. Do not apply home-page CSS
constraints mechanically to Starlight components.

`public/404.html` is standalone and may use plain CSS. Do not copy its patterns
into bundled components.

## Structure

- `src/pages/index.astro`: home sections, metadata, and island placement.
- `src/shared/ui.ts`: shared Tailwind compositions.
- `src/styles/home.css`: tokens and base layer.
- `src/features/home/components/`: home React islands.
- `src/features/docs/`: docs components and styles.
- `src/features/playground/README.md`: Playground architecture and invariants.

Home section anchors use `id` and `sectionAnchor`. Add `data-section` to the
outer section for scroll spy.

## Verification

Run `pnpm gate` before committing site changes. Use a production build and
preview for responsive layout checks.
