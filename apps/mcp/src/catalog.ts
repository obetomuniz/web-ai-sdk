import generatedCatalog from "./generated/docs.json";
import type {
  BrowserSupportRecord,
  DocumentationCatalog,
  DocumentationRecord,
  DocumentationSearchResult,
  DocumentKind,
} from "./types.js";

const isDocumentKind = (value: string): value is DocumentKind =>
  value === "start" ||
  value === "guides" ||
  value === "packages" ||
  value === "react";

const catalog: DocumentationCatalog = {
  documents: generatedCatalog.documents.map((document) => {
    if (!isDocumentKind(document.kind)) {
      throw new Error(`Unknown documentation kind: ${document.kind}`);
    }
    return { ...document, kind: document.kind };
  }),
  browserSupport: generatedCatalog.browserSupport,
};

const normalize = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase();

const normalizeWithOffsets = (
  value: string,
): { normalized: string; originalOffsets: number[] } => {
  const normalizedChunks: string[] = [];
  const originalOffsets: number[] = [];
  let originalOffset = 0;

  for (const character of value) {
    const normalizedCharacter = normalize(character);
    normalizedChunks.push(normalizedCharacter);
    for (let index = 0; index < normalizedCharacter.length; index += 1) {
      originalOffsets.push(originalOffset);
    }
    originalOffset += character.length;
  }

  return { normalized: normalizedChunks.join(""), originalOffsets };
};

const queryTokens = (query: string): string[] => [
  ...new Set(normalize(query).match(/[a-z0-9@./_-]+/gu) ?? []),
];

const countMatches = (text: string, token: string): number => {
  let count = 0;
  let offset = 0;
  while (count < 5) {
    const match = text.indexOf(token, offset);
    if (match < 0) return count;
    count += 1;
    offset = match + token.length;
  }
  return count;
};

const scoreDocument = (
  document: DocumentationRecord,
  normalizedQuery: string,
  tokens: readonly string[],
): { score: number; matchedTokens: string[] } => {
  const title = normalize(document.title);
  const description = normalize(document.description);
  const identity = normalize(`${document.id} ${document.uri}`);
  const body = normalize(document.body);
  const combined = `${title} ${description} ${identity} ${body}`;

  const matchedTokens = tokens.filter((token) => combined.includes(token));
  // A strict majority of tokens must match so long natural-language queries
  // can rank by partial coverage while unrelated queries still return nothing.
  if (matchedTokens.length * 2 <= tokens.length) {
    return { score: 0, matchedTokens };
  }

  let score = (matchedTokens.length / tokens.length) * 40;
  if (title === normalizedQuery) score += 120;
  else if (title.includes(normalizedQuery)) score += 60;
  if (identity.includes(normalizedQuery)) score += 45;
  if (description.includes(normalizedQuery)) score += 30;

  for (const token of matchedTokens) {
    if (title.includes(token)) score += 24;
    if (identity.includes(token)) score += 18;
    if (description.includes(token)) score += 12;
    score += countMatches(body, token) * 2;
  }
  return { score, matchedTokens };
};

const excerptFrom = (
  document: DocumentationRecord,
  tokens: readonly string[],
): string => {
  const compact = document.body.replace(/\s+/gu, " ").trim();
  const { normalized: normalizedBody, originalOffsets } =
    normalizeWithOffsets(compact);
  const positions = tokens
    .map((token) => normalizedBody.indexOf(token))
    .filter((position) => position >= 0);
  const normalizedFirstMatch =
    positions.length > 0 ? Math.min(...positions) : 0;
  const firstMatch = originalOffsets[normalizedFirstMatch] ?? 0;
  const start = Math.max(0, firstMatch - 90);
  const end = Math.min(compact.length, start + 320);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < compact.length ? "…" : "";
  return `${prefix}${compact.slice(start, end).trim()}${suffix}`;
};

export const documents = catalog.documents;
export const browserSupport = catalog.browserSupport;

export const searchDocumentation = (
  query: string,
  limit = 5,
): DocumentationSearchResult[] => {
  const normalizedQuery = normalize(query.trim());
  const tokens = queryTokens(query);
  if (!normalizedQuery || tokens.length === 0) return [];

  return documents
    .map((document) => ({
      document,
      ...scoreDocument(document, normalizedQuery, tokens),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.document.title.localeCompare(right.document.title),
    )
    .slice(0, limit)
    .map(({ document, matchedTokens }) => ({
      id: document.id,
      uri: document.uri,
      url: document.url,
      title: document.title,
      description: document.description,
      kind: document.kind,
      excerpt: excerptFrom(document, matchedTokens),
    }));
};

const identifierCandidates = (identifier: string): string[] => {
  const trimmed = identifier.trim().replace(/\/+$/u, "");
  const candidates = new Set([trimmed]);

  if (trimmed.startsWith("web-ai-sdk://docs/")) {
    candidates.add(trimmed.slice("web-ai-sdk://docs/".length));
  }
  if (trimmed === "https://web-ai-sdk.dev/docs") {
    candidates.add("index");
  } else if (trimmed.startsWith("https://web-ai-sdk.dev/docs/")) {
    const path = trimmed.slice("https://web-ai-sdk.dev/docs/".length);
    candidates.add(path || "index");
  }
  if (trimmed === "/docs") {
    candidates.add("index");
  } else if (trimmed.startsWith("/docs/")) {
    candidates.add(trimmed.slice("/docs/".length) || "index");
  }
  if (trimmed.startsWith("@web-ai-sdk/")) {
    const packageName = trimmed.slice("@web-ai-sdk/".length);
    candidates.add(`packages/${packageName}`);
  }

  return [...candidates];
};

export const readDocumentation = (
  identifier: string,
): DocumentationRecord | undefined => {
  const candidates = identifierCandidates(identifier);
  return documents.find(
    (document) =>
      candidates.includes(document.id) ||
      candidates.includes(document.uri) ||
      candidates.includes(document.url) ||
      candidates.includes(document.route.replace(/\/+$/u, "")),
  );
};

const normalizeCapability = (value: string): string =>
  normalize(value)
    .replace("@web-ai-sdk/", "")
    .replaceAll(/[\s_-]+/gu, "");

export const getBrowserSupport = (
  capability?: string,
): BrowserSupportRecord[] => {
  if (!capability?.trim()) return browserSupport;
  const requested = normalizeCapability(capability);
  return browserSupport.filter((entry) => {
    const packageName = entry.package.replace("@web-ai-sdk/", "");
    return (
      normalizeCapability(packageName) === requested ||
      normalizeCapability(entry.capability) === requested ||
      (requested === "languagedetector" && packageName === "detector")
    );
  });
};
