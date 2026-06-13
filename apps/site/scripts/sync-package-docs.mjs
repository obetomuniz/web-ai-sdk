#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const packageDocsDir = resolve(
  repoRoot,
  "apps/site/src/content/docs/packages",
);
const check = process.argv.includes("--check");

const packages = [
  { name: "all", readme: "packages/sdk/README.md" },
  { name: "prompt", readme: "packages/prompt/README.md" },
  { name: "webmcp", readme: "packages/webmcp/README.md" },
  { name: "summarizer", readme: "packages/summarizer/README.md" },
  { name: "translator", readme: "packages/translator/README.md" },
  { name: "detector", readme: "packages/detector/README.md" },
  { name: "writer", readme: "packages/writer/README.md" },
  { name: "rewriter", readme: "packages/rewriter/README.md" },
  { name: "proofreader", readme: "packages/proofreader/README.md" },
];

const stripGeneratedOnlyLines = (lines) =>
  lines.filter((line) => !line.startsWith("**Docs:**"));

const readmeBody = (markdown) => {
  const lines = markdown.replaceAll("\r\n", "\n").trimEnd().split("\n");
  if (lines[0]?.startsWith("# ")) {
    lines.shift();
    if (lines[0] === "") lines.shift();
  }
  return stripGeneratedOnlyLines(lines).join("\n").trimStart();
};

const descriptionFrom = (body) => {
  const paragraph = body
    .split(/\n\s*\n/u)
    .find((block) => block.trim() && !block.trim().startsWith("**Docs:**"));
  if (!paragraph) return "";
  return paragraph
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim();
};

const renderPage = ({ name, readme, markdown }) => {
  const body = readmeBody(markdown);
  const title = name === "all" ? "@web-ai-sdk/all" : `@web-ai-sdk/${name}`;
  const description = descriptionFrom(body);

  return `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(description)}
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/${readme}
---

:::note
This page is synced from [\`${readme}\`](https://github.com/obetomuniz/web-ai-sdk/blob/main/${readme}) by \`pnpm --filter @web-ai-sdk-apps/site docs:sync\`. Edits should go to the README.
:::

${body}
`;
};

const changed = [];

for (const pkg of packages) {
  const readmePath = resolve(repoRoot, pkg.readme);
  const pagePath = resolve(packageDocsDir, `${pkg.name}.md`);
  const markdown = await readFile(readmePath, "utf8");
  const next = renderPage({ ...pkg, markdown });

  let current = "";
  try {
    current = await readFile(pagePath, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  if (current !== next) {
    changed.push(pagePath);
    if (!check) {
      await mkdir(dirname(pagePath), { recursive: true });
      await writeFile(pagePath, next);
    }
  }
}

if (check && changed.length > 0) {
  console.error("Package docs are out of sync:");
  for (const file of changed) console.error(`  ${file}`);
  console.error(
    "Run `pnpm --filter @web-ai-sdk-apps/site docs:sync` to update them.",
  );
  process.exit(1);
}

if (changed.length > 0) {
  console.log(`Synced ${changed.length} package docs page(s).`);
} else {
  console.log("Package docs are already in sync.");
}
