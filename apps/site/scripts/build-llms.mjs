// Generate llms.txt, llms-full.txt, and sitemap.xml for the canonical
// web-ai-sdk.dev deploy. Run as a postbuild step after `astro build` so the
// files land in apps/site/dist/ and are picked up by the Pages artifact.
//
// Inputs:
//   - packages/*/README.md             (source of truth for llms content)
//   - apps/site/src/content/docs/** (route enumeration for sitemap)
// Outputs:
//   - apps/site/dist/llms.txt
//   - apps/site/dist/llms-full.txt
//   - apps/site/dist/sitemap.xml
//
// llms.txt format follows https://llmstxt.org — H1 title, blockquote
// summary, per-section bullet list of links. llms-full.txt concatenates the
// full README bodies so an LLM can ingest everything in one fetch.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
const PACKAGES_DIR = resolve(REPO_ROOT, "packages");
const DOCS_CONTENT_DIR = resolve(
  REPO_ROOT,
  "apps/site/src/content/docs",
);
const DIST_DIR = resolve(HERE, "../dist");

const SITE_URL = "https://web-ai-sdk.dev";
const REPO_URL = "https://github.com/obetomuniz/web-ai-sdk";

// Package directory → npm name. `sdk/` is published as `@web-ai-sdk/all`.
// READMEs on GitHub are the canonical per-package reference; the docs site
// hosts hand-curated guides rather than mirroring README content.
const PACKAGES = [
  { dir: "sdk", npm: "@web-ai-sdk/all" },
  { dir: "prompt", npm: "@web-ai-sdk/prompt" },
  { dir: "webmcp", npm: "@web-ai-sdk/webmcp" },
  { dir: "summarizer", npm: "@web-ai-sdk/summarizer" },
  { dir: "translator", npm: "@web-ai-sdk/translator" },
  { dir: "detector", npm: "@web-ai-sdk/detector" },
];

const readmeUrl = (dir) => `${REPO_URL}/tree/main/packages/${dir}#readme`;

function readReadme(dir) {
  return readFileSync(resolve(PACKAGES_DIR, dir, "README.md"), "utf8");
}

function summary(md) {
  // First non-empty paragraph after the H1.
  const lines = md.split(/\r?\n/);
  let pastH1 = false;
  const buf = [];
  for (const line of lines) {
    if (!pastH1) {
      if (/^#\s+/.test(line)) pastH1 = true;
      continue;
    }
    if (buf.length === 0 && line.trim() === "") continue;
    if (line.trim() === "") {
      if (buf.length > 0) break;
      continue;
    }
    if (/^(#|`{3}|>)/.test(line.trim())) {
      if (buf.length > 0) break;
      continue;
    }
    buf.push(line.trim());
  }
  return buf.join(" ").replace(/\s+/g, " ").trim();
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function docsRoutes() {
  // Convert each content file path to its Starlight route.
  const files = walk(DOCS_CONTENT_DIR).filter((f) => /\.(md|mdx)$/.test(f));
  const routes = new Set();
  routes.add("/docs/");
  for (const f of files) {
    const rel = relative(DOCS_CONTENT_DIR, f).replace(/\\/g, "/");
    const slug = rel.replace(/\.(md|mdx)$/, "");
    if (slug === "index") continue;
    routes.add(`/docs/${slug}/`);
  }
  return [...routes].sort();
}

function buildLlmsIndex() {
  const packageLines = PACKAGES.map((p) => {
    const md = readReadme(p.dir);
    const desc = summary(md);
    return `- [${p.npm}](${readmeUrl(p.dir)}): ${desc}`;
  });

  return [
    "# web-ai-sdk",
    "",
    "> Building blocks for the Web's built-in AI APIs. Composable. No runtime deps. Just lifecycle, streaming, AbortSignals. Vanilla TypeScript by default, with optional React hooks.",
    "",
    "Each package wraps one Built-in AI surface (Prompt, Summarizer, Translator, Detector, WebMCP) plus an optional `/react` adapter. The per-package READMEs (linked below) are the source of truth for the API surface; the docs site hosts hand-curated conceptual guides. Full README content is also available concatenated at [llms-full.txt](" + SITE_URL + "/llms-full.txt).",
    "",
    "## Packages",
    "",
    ...packageLines,
    "",
    "## Guides",
    "",
    "- [Browser support](" + SITE_URL + "/docs/browser-support/): which Chrome/Edge versions and flags each API needs.",
    "- [Meta-package](" + SITE_URL + "/docs/guides/meta-package/): `@web-ai-sdk/all` — subpath vs namespaced import shapes.",
    "- [Prompt](" + SITE_URL + "/docs/guides/prompt/): conceptual overview — sessions, streaming, sampling, structured output, abort.",
    "- [WebMCP](" + SITE_URL + "/docs/guides/webmcp/): registering tools with `document.modelContext`.",
    "- [Summarizer](" + SITE_URL + "/docs/guides/summarizer/): TL;DR / key-points / headline with streaming.",
    "- [Translator](" + SITE_URL + "/docs/guides/translator/): block-level DOM translation with snapshot restore.",
    "- [Detector](" + SITE_URL + "/docs/guides/detector/): on-device language detection with confidence.",
    "",
    "## React adapters",
    "",
    "- [usePrompt](" + SITE_URL + "/docs/react/use-prompt/)",
    "- [useSession](" + SITE_URL + "/docs/react/use-session/)",
    "- [useWebMCP](" + SITE_URL + "/docs/react/use-web-mcp/)",
    "- [useSummarizer](" + SITE_URL + "/docs/react/use-summarizer/)",
    "- [useTranslator](" + SITE_URL + "/docs/react/use-translator/)",
    "- [useDetector](" + SITE_URL + "/docs/react/use-detector/)",
    "",
    "## Optional",
    "",
    "- [Source repository](" + REPO_URL + ")",
    "- [Full text of every README](" + SITE_URL + "/llms-full.txt)",
    "",
  ].join("\n");
}

function buildLlmsFull() {
  const parts = [
    "# web-ai-sdk — full package documentation",
    "",
    "> Concatenated content of every packages/*/README.md, in the order published. Generated at build time; the READMEs in the GitHub repo are the source of truth.",
    "",
    `> Source: ${REPO_URL}`,
    "",
  ];
  for (const p of PACKAGES) {
    const md = readReadme(p.dir);
    parts.push("---");
    parts.push("");
    parts.push(`<!-- Source: ${readmeUrl(p.dir)} -->`);
    parts.push("");
    parts.push(md.trimEnd());
    parts.push("");
  }
  return parts.join("\n");
}

function buildSitemap() {
  const now = new Date().toISOString();
  const urls = ["/", ...docsRoutes()];
  const body = urls
    .map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${now}</lastmod></url>`)
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    "</urlset>",
    "",
  ].join("\n");
}

function main() {
  const llms = buildLlmsIndex();
  const llmsFull = buildLlmsFull();
  const sitemap = buildSitemap();

  writeFileSync(resolve(DIST_DIR, "llms.txt"), llms);
  writeFileSync(resolve(DIST_DIR, "llms-full.txt"), llmsFull);
  writeFileSync(resolve(DIST_DIR, "sitemap.xml"), sitemap);

  console.log(`[build-llms] wrote ${DIST_DIR}/llms.txt (${llms.length} bytes)`);
  console.log(`[build-llms] wrote ${DIST_DIR}/llms-full.txt (${llmsFull.length} bytes)`);
  console.log(`[build-llms] wrote ${DIST_DIR}/sitemap.xml (${sitemap.length} bytes)`);
}

main();
