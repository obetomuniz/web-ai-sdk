// @ts-check
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// Base path mirrors the landing site's VITE_BASE convention so the same
// SITE_BASE value drives both deploys. Defaults to the GH Pages
// `/web-ai-sdk/` prefix; override at build time for org Pages (`/`) or a
// custom domain. The Pages workflow sets DOCS_BASE; locally `pnpm
// pages:build` sets it explicitly so the assembled `_site/docs/` works
// when served from `/`.
const base = process.env.DOCS_BASE ?? "/web-ai-sdk/docs/";

export default defineConfig({
  base,
  // No trailing slash in `site` — Starlight composes it with `base`.
  site: "https://obetomuniz.github.io",
  integrations: [
    starlight({
      title: "web-ai-sdk",
      description:
        "Headless wrappers for the Web's built-in AI APIs. Lifecycle, streaming, AbortSignals.",
      // Match the landing's cinnabar/dark identity. Token overrides live
      // in src/styles/web-ai-sdk.css. Demo card styles in demos.css use
      // those same tokens so the live React demos in MDX pages follow the
      // active theme (light/dark) instead of hardcoding white surfaces.
      customCss: [
        "./src/styles/web-ai-sdk.css",
        "./src/styles/demos.css",
      ],
      social: {
        github: "https://github.com/obetomuniz/web-ai-sdk",
      },
      editLink: {
        baseUrl:
          "https://github.com/obetomuniz/web-ai-sdk/edit/main/apps/docs/",
      },
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "Browser support", slug: "browser-support" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Prompt", slug: "guides/prompt" },
            { label: "WebMCP", slug: "guides/webmcp" },
            { label: "Summarizer", slug: "guides/summarizer" },
            { label: "Translator", slug: "guides/translator" },
            { label: "Detector", slug: "guides/detector" },
          ],
        },
        {
          label: "React Hooks",
          items: [
            { label: "usePrompt", slug: "react/use-prompt" },
            { label: "useWebMCP", slug: "react/use-web-mcp" },
            { label: "useSummarizer", slug: "react/use-summarizer" },
            { label: "useTranslator", slug: "react/use-translator" },
            { label: "useDetector", slug: "react/use-detector" },
          ],
        },
      ],
    }),
    react(),
  ],
});
