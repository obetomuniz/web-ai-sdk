#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
const DOCS_ROOT = resolve(REPO_ROOT, "apps/site/src/content/docs");
const OUTPUT = resolve(HERE, "../src/generated/docs.json");
const SITE_URL = "https://web-ai-sdk.dev";

const capabilityNames = {
  prompt: "Prompt",
  summarizer: "Summarizer",
  translator: "Translator",
  detector: "Language Detector",
  writer: "Writer",
  rewriter: "Rewriter",
  proofreader: "Proofreader",
  webmcp: "WebMCP",
};

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (/\.(md|mdx)$/u.test(entry.name)) files.push(path);
  }
  return files;
};

const parseScalar = (value) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
};

const readFrontmatter = (markdown) => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u);
  if (!match) return { attributes: {}, body: markdown };

  const attributes = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    attributes[key] = parseScalar(line.slice(separator + 1));
  }

  return {
    attributes,
    body: markdown.slice(match[0].length),
  };
};

const replaceBrowserHeading = (line) =>
  line.replace(
    /<BrowserTableHeading\b[^>]*\blabel="([^"]+)"[^>]*\/>/gu,
    "$1",
  );

const cleanMdx = (markdown) => {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const output = [];
  let fenced = false;

  for (const originalLine of lines) {
    const trimmed = originalLine.trim();
    if (/^```/u.test(trimmed)) {
      fenced = !fenced;
      output.push(originalLine);
      continue;
    }
    if (fenced) {
      output.push(originalLine);
      continue;
    }

    if (/^import\s.+\sfrom\s["'][^"']+["'];?$/u.test(trimmed)) continue;
    if (/^<\/?DemoSlot\b/u.test(trimmed)) continue;
    if (/^<[A-Z][A-Za-z0-9]*\b[^>]*\/>$/u.test(trimmed)) continue;

    output.push(replaceBrowserHeading(originalLine));
  }

  return output.join("\n").replace(/\n{3,}/gu, "\n\n").trim();
};

const kindFrom = (id) => {
  const [prefix] = id.split("/");
  if (prefix === "guides" || prefix === "packages" || prefix === "react") {
    return prefix;
  }
  return "start";
};

const routeFrom = (id) => (id === "index" ? "/docs/" : `/docs/${id}/`);

const buildDocument = async (path) => {
  const sourcePath = relative(REPO_ROOT, path).replaceAll("\\", "/");
  const relativePath = relative(DOCS_ROOT, path).replaceAll("\\", "/");
  const id = relativePath.replace(/\.(md|mdx)$/u, "");
  const raw = await readFile(path, "utf8");
  const { attributes, body } = readFrontmatter(raw);
  const title = attributes.title;
  const description = attributes.description;
  if (typeof title !== "string" || typeof description !== "string") {
    throw new Error(`${sourcePath} must define title and description.`);
  }

  const route = routeFrom(id);
  return {
    id,
    uri: `web-ai-sdk://docs/${id}`,
    route,
    url: `${SITE_URL}${route}`,
    sourcePath,
    kind: kindFrom(id),
    title,
    description,
    body: cleanMdx(body),
  };
};

const plainCell = (cell) =>
  cell
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replaceAll("`", "")
    .replace(/\s+/gu, " ")
    .trim();

const linksFrom = (cell) =>
  [...cell.matchAll(/\[[^\]]+\]\((https:\/\/[^)]+)\)/gu)].map(
    (match) => match[1],
  );

const buildBrowserSupport = (documents) => {
  const support = documents.find((document) => document.id === "browser-support");
  if (!support) throw new Error("browser-support.mdx is required.");

  const entries = [];
  for (const line of support.body.split("\n")) {
    if (!/^\| `@web-ai-sdk\//u.test(line)) continue;
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    const packageCell = cells[0];
    const chromeCell = cells[1];
    const edgeCell = cells[2];
    const fallbackCell = cells[3];
    if (!packageCell || !chromeCell || !edgeCell || !fallbackCell) continue;

    const packageName = plainCell(packageCell);
    const slug = packageName.replace("@web-ai-sdk/", "");
    const capability = capabilityNames[slug];
    if (!capability) throw new Error(`Unknown browser capability: ${slug}`);

    entries.push({
      capability,
      package: packageName,
      chrome: plainCell(chromeCell),
      edge: plainCell(edgeCell),
      fallback: plainCell(fallbackCell),
      sources: [...new Set([...linksFrom(chromeCell), ...linksFrom(edgeCell)])],
    });
  }

  if (entries.length !== Object.keys(capabilityNames).length) {
    throw new Error("The browser support table is incomplete.");
  }
  return entries;
};

const files = (await walk(DOCS_ROOT)).sort();
const documents = await Promise.all(files.map(buildDocument));
documents.sort((left, right) => left.id.localeCompare(right.id));

const catalog = {
  documents,
  browserSupport: buildBrowserSupport(documents),
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(
  `[mcp-docs] indexed ${documents.length} documents and ${catalog.browserSupport.length} browser support entries`,
);
