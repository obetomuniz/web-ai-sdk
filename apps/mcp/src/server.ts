import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  documents,
  getBrowserSupport,
  readDocumentation,
  searchDocumentation,
} from "./catalog.js";
import type {
  BrowserSupportRecord,
  DocumentationRecord,
  DocumentationSearchResult,
} from "./types.js";

export const SERVER_NAME = "web-ai-sdk-docs";
export const SERVER_VERSION = "0.1.0";

const toolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const searchResultSchema = z.object({
  id: z.string(),
  uri: z.string(),
  url: z.string().url(),
  title: z.string(),
  description: z.string(),
  kind: z.enum(["start", "guides", "packages", "react"]),
  excerpt: z.string(),
});

const documentationSchema = z.object({
  id: z.string(),
  uri: z.string(),
  route: z.string(),
  url: z.string().url(),
  sourcePath: z.string(),
  kind: z.enum(["start", "guides", "packages", "react"]),
  title: z.string(),
  description: z.string(),
  body: z.string(),
});

const browserSupportSchema = z.object({
  capability: z.string(),
  package: z.string(),
  chrome: z.string(),
  edge: z.string(),
  fallback: z.string(),
  sources: z.array(z.string().url()),
});

const renderSearchResults = (results: DocumentationSearchResult[]): string => {
  if (results.length === 0) {
    return "No matching web-ai-sdk documentation was found.";
  }
  return results
    .map(
      (result) =>
        `## ${result.title}\n\n${result.description}\n\n${result.excerpt}\n\nSource: ${result.url}\nDocument ID: ${result.id}`,
    )
    .join("\n\n---\n\n");
};

const renderDocumentation = (document: DocumentationRecord): string =>
  `# ${document.title}\n\n${document.description}\n\nCanonical URL: ${document.url}\n\n${document.body}`;

const renderBrowserSupport = (entries: BrowserSupportRecord[]): string => {
  if (entries.length === 0) {
    return "No browser support entry matched that capability.";
  }
  const rows = entries.map(
    (entry) =>
      `| ${entry.package} | ${entry.chrome} | ${entry.edge} | ${entry.fallback} |`,
  );
  return [
    "| Package | Chrome | Edge | Missing API |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "Canonical source: https://web-ai-sdk.dev/docs/browser-support/",
  ].join("\n");
};

export const createDocumentationServer = (): McpServer => {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Use search_docs to find web-ai-sdk guidance. Use read_doc for the complete canonical page. Check get_browser_support before recommending a browser capability.",
    },
  );

  for (const document of documents) {
    server.registerResource(
      document.id,
      document.uri,
      {
        title: document.title,
        description: document.description,
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: renderDocumentation(document),
          },
        ],
      }),
    );
  }

  server.registerTool(
    "search_docs",
    {
      title: "Search web-ai-sdk documentation",
      description:
        "Search canonical web-ai-sdk package references, guides, React hook documentation, architecture, and production guidance.",
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe("Words, API names, package names, or behavior to find."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("Maximum results. Defaults to 5."),
      }),
      outputSchema: z.object({ results: z.array(searchResultSchema) }),
      annotations: toolAnnotations,
    },
    async ({ query, limit }) => {
      const results = searchDocumentation(query, limit ?? 5);
      const output = { results };
      return {
        content: [{ type: "text", text: renderSearchResults(results) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "read_doc",
    {
      title: "Read web-ai-sdk documentation",
      description:
        "Read one complete canonical web-ai-sdk document by search result ID, MCP resource URI, package name, path, or documentation URL.",
      inputSchema: z.object({
        identifier: z
          .string()
          .trim()
          .min(1)
          .max(300)
          .describe(
            "A document ID, web-ai-sdk:// URI, @web-ai-sdk package name, /docs path, or canonical URL.",
          ),
      }),
      outputSchema: z.object({ document: documentationSchema }),
      annotations: toolAnnotations,
    },
    async ({ identifier }) => {
      const document = readDocumentation(identifier);
      if (!document) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `No document matched "${identifier}". Call search_docs to find a valid document ID.`,
            },
          ],
        };
      }
      const output = { document };
      return {
        content: [{ type: "text", text: renderDocumentation(document) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "get_browser_support",
    {
      title: "Get browser support",
      description:
        "Get current documented Chrome and Edge support for one web-ai-sdk capability or every capability.",
      inputSchema: z.object({
        capability: z
          .string()
          .trim()
          .max(100)
          .optional()
          .describe(
            "A capability or package, such as Prompt, Language Detector, or @web-ai-sdk/webmcp. Omit it for all capabilities.",
          ),
      }),
      outputSchema: z.object({
        sourceUrl: z.string().url(),
        entries: z.array(browserSupportSchema),
      }),
      annotations: toolAnnotations,
    },
    async ({ capability }) => {
      const entries = getBrowserSupport(capability);
      const output = {
        sourceUrl: "https://web-ai-sdk.dev/docs/browser-support/",
        entries,
      };
      return {
        content: [{ type: "text", text: renderBrowserSupport(entries) }],
        structuredContent: output,
      };
    },
  );

  return server;
};
