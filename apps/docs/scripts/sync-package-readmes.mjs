// Generate Starlight pages under /docs/packages/<pkg>/ from each
// packages/*/README.md. The READMEs are the single source of truth; this
// script is run before `astro build` so the rendered HTML and the npm
// README never drift.
//
// Output dir is wiped on every run so renamed/removed packages don't leak.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
const PACKAGES_DIR = resolve(REPO_ROOT, "packages");
const OUT_DIR = resolve(HERE, "../src/content/docs/packages");

// Package directory → docs slug (matches the npm name suffix).
// `sdk/` is published as @web-ai-sdk/all, so its route is /docs/packages/all/.
const SLUG_MAP = {
  detector: "detector",
  prompt: "prompt",
  sdk: "all",
  summarizer: "summarizer",
  translator: "translator",
  webmcp: "webmcp",
};

function escapeYaml(s) {
  return s.replace(/"/g, '\\"');
}

function extractTitle(md) {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : "";
}

function extractDescription(md) {
  // First non-empty paragraph after the H1 that isn't itself a heading or
  // a code fence. Collapsed to a single line for the meta description.
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
  return buf
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
    .replace(/`([^`]+)`/g, "$1") // `code` → code
    .replace(/\s+/g, " ")
    .trim();
}

function stripFirstH1(md) {
  return md.replace(/^#\s+.+?\r?\n+/, "");
}

function buildPage(pkgDir, slug) {
  const readmePath = resolve(PACKAGES_DIR, pkgDir, "README.md");
  const raw = readFileSync(readmePath, "utf8");
  const title = extractTitle(raw) || `@web-ai-sdk/${slug}`;
  const description = extractDescription(raw);
  const body = stripFirstH1(raw);

  const sourceUrl = `https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/${pkgDir}/README.md`;
  const editUrl = `https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/${pkgDir}/README.md`;

  const frontmatter = [
    "---",
    `title: "${escapeYaml(title)}"`,
    description ? `description: "${escapeYaml(description)}"` : null,
    `editUrl: ${editUrl}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const banner = [
    `:::note`,
    `This page is generated from [\`packages/${pkgDir}/README.md\`](${sourceUrl}) on every build. Edits should go to the README.`,
    `:::`,
    "",
  ].join("\n");

  return `${frontmatter}\n\n${banner}${body.trimStart()}`;
}

function main() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const dirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const dir of dirs) {
    const slug = SLUG_MAP[dir];
    if (!slug) {
      console.warn(`[sync-package-readmes] skipping unmapped package dir: ${dir}`);
      continue;
    }
    const page = buildPage(dir, slug);
    const out = resolve(OUT_DIR, `${slug}.md`);
    writeFileSync(out, page);
    console.log(`[sync-package-readmes] wrote ${out}`);
  }
}

main();
