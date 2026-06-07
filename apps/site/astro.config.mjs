// @ts-check
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Defaults to the custom-domain root. GitHub Pages builds override this with
// SITE_BASE for project Pages or any other host prefix.
const base = process.env.SITE_BASE ?? "/";

export default defineConfig({
  base,
  site: "https://web-ai-sdk.dev",
  vite: {
    plugins: [tailwindcss()],
    // Keep a single React instance and optimize every SDK `/react` subpath up
    // front. Without this, Vite discovers each `@web-ai-sdk/*/react` package
    // lazily on first visit, re-runs optimizeDeps, and the brief window where
    // two React copies coexist throws "Invalid hook call".
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@web-ai-sdk/prompt/react",
        "@web-ai-sdk/summarizer/react",
        "@web-ai-sdk/translator/react",
        "@web-ai-sdk/detector/react",
        "@web-ai-sdk/writer/react",
        "@web-ai-sdk/rewriter/react",
        "@web-ai-sdk/proofreader/react",
        "@web-ai-sdk/webmcp/react",
      ],
    },
  },
  integrations: [
    starlight({
      title: "web-ai-sdk",
      description:
        "Headless wrappers for the Web's built-in AI APIs. Lifecycle, streaming, AbortSignals.",
      disable404Route: true,
      components: {
        Head: "./src/features/docs/components/Head.astro",
      },
      favicon: "/favicon.svg",
      head: [
        {
          tag: "script",
          attrs: {
            defer: true,
            src: "https://cloud.umami.is/script.js",
            "data-website-id": "9e24f5c3-6b64-48fc-8679-610907092f1c",
          },
        },
        {
          tag: "link",
          attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" },
        },
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
            crossorigin: true,
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: "https://web-ai-sdk.dev/og-image.png",
          },
        },
        {
          tag: "meta",
          attrs: { property: "og:image:type", content: "image/png" },
        },
        {
          tag: "meta",
          attrs: { property: "og:image:width", content: "1200" },
        },
        {
          tag: "meta",
          attrs: { property: "og:image:height", content: "630" },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:alt",
            content: "web-ai-sdk — npm install @web-ai-sdk/all",
          },
        },
        {
          tag: "meta",
          attrs: { name: "twitter:card", content: "summary_large_image" },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: "https://web-ai-sdk.dev/og-image.png",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "alternate",
            type: "text/plain",
            title: "LLM-friendly docs (llms.txt)",
            href: "https://web-ai-sdk.dev/llms.txt",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "alternate",
            type: "text/plain",
            title: "LLM-friendly docs (full text)",
            href: "https://web-ai-sdk.dev/llms-full.txt",
          },
        },
        {
          tag: "script",
          content:
            "document.addEventListener('DOMContentLoaded',function(){var k=document.querySelector('site-search button kbd');if(k)k.setAttribute('aria-hidden','true');});",
        },
      ],
      customCss: [
        "./src/features/docs/styles/tailwind.css",
        "./src/features/docs/styles/web-ai-sdk.css",
        "./src/features/docs/styles/demos.css",
      ],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/obetomuniz/web-ai-sdk",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/obetomuniz/web-ai-sdk/edit/main/apps/site/",
      },
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "Browser support", slug: "docs/browser-support" },
            { label: "Architecture", slug: "docs/architecture" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Meta-package", slug: "docs/guides/meta-package" },
            { label: "Prompt", slug: "docs/guides/prompt" },
            { label: "WebMCP", slug: "docs/guides/webmcp" },
            { label: "Summarizer", slug: "docs/guides/summarizer" },
            { label: "Translator", slug: "docs/guides/translator" },
            { label: "Detector", slug: "docs/guides/detector" },
            { label: "Writer", slug: "docs/guides/writer" },
            { label: "Rewriter", slug: "docs/guides/rewriter" },
            { label: "Proofreader", slug: "docs/guides/proofreader" },
          ],
        },
        {
          label: "React Hooks",
          items: [
            { label: "usePrompt", slug: "docs/react/use-prompt" },
            { label: "useSession", slug: "docs/react/use-session" },
            { label: "useWebMCP", slug: "docs/react/use-web-mcp" },
            { label: "useSummarizer", slug: "docs/react/use-summarizer" },
            { label: "useTranslator", slug: "docs/react/use-translator" },
            { label: "useDetector", slug: "docs/react/use-detector" },
            { label: "useWriter", slug: "docs/react/use-writer" },
            { label: "useRewriter", slug: "docs/react/use-rewriter" },
            { label: "useProofreader", slug: "docs/react/use-proofreader" },
          ],
        },
      ],
    }),
    react(),
  ],
});
