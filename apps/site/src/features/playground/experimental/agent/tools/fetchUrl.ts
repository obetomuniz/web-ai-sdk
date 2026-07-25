/**
 * `fetch_url` tool: content-type-aware HTTP GET for an on-device agent.
 *
 * Three response shapes, chosen by `Content-Type`:
 *
 * - **JSON** → parsed and returned as `body` (right for APIs like the
 *   GitHub repo endpoint).
 * - **HTML** → parsed with an inert `DOMParser` and reduced to clean,
 *   structured reading text (headings / paragraphs / list items), with
 *   a compact `Sections:` outline pinned to the top. This is the fix
 *   for "summarize this blog post": feeding the model 6 KB of raw HTML
 *   is 6 KB of `<head>` + nav + inline CSS, so the article body never
 *   reaches it. Extracting first makes those same bytes 6 KB of signal.
 * - **anything else** → returned as truncated raw text.
 *
 * Security: the HTML is parsed into an INERT document (`DOMParser` with
 * `"text/html"` does not execute scripts or load resources) and only
 * `textContent` is read - never re-injected into the live DOM as HTML.
 * No `innerHTML`, no rendering, no XSS vector (frontend rule F5).
 *
 * Trust boundary: GET only, HTTP(S) only, optional origin allowlist,
 * raw body capped at `maxBytes`. A production kit should let the host
 * inject its own fetcher (auth, retry, rate limits).
 */

import type { AgentRunContext } from "../runContext.js";
import type { AgentTool } from "../types.js";
import { isContextuallyGroundedUrl, normUrl } from "../urls.js";

interface FetchInput {
  url: string;
}

interface FetchOutput {
  status: number;
  contentType: string | null;
  truncated: boolean;
  /** "json" | "article" | "text" - tells the model how to read the payload. */
  format?: "json" | "article" | "text";
  body?: unknown;
  text?: string;
  error?: string;
}

export interface FetchUrlToolOptions {
  /** If set, the tool will refuse URLs whose origin isn't in this list. */
  allowedOrigins?: readonly string[];
  /**
   * Max RAW response bytes to download before parsing/extracting.
   * Default 512 KB. HTML extraction needs the whole page (the article
   * body can sit well past the first 32 KB of head / nav / inline CSS),
   * and extraction shrinks it dramatically before anything reaches the
   * model.
   */
  maxBytes?: number;
  /** Max chars of EXTRACTED article text the tool returns. Default 16 KB. */
  maxArticleChars?: number;
}

export function createFetchUrlTool(
  options: FetchUrlToolOptions = {},
): AgentTool<FetchInput, FetchOutput> {
  const maxBytes = options.maxBytes ?? 512 * 1024;
  const maxArticleChars = options.maxArticleChars ?? 16 * 1024;
  const allowedOrigins = options.allowedOrigins
    ? new Set(options.allowedOrigins)
    : null;

  return {
    name: "fetch_url",
    description:
      "Fetch a URL via HTTPS GET. JSON responses come back parsed (use for APIs like api.github.com). HTML pages (blog posts, articles, docs) come back as clean reading text - headings, paragraphs, lists, plus a `Sections:` outline - with the markup stripped, so you can actually answer questions about the page contents. Bounded by the browser's same-origin policy: only works on origins that send `Access-Control-Allow-Origin`. Refuses non-HTTP(S) schemes.",
    readOnly: true,
    acceptCall(input: Record<string, unknown>, ctx: AgentRunContext): boolean {
      const url = typeof input.url === "string" ? input.url : "";
      if (!url.trim()) return false;
      if (ctx.userUrls.has(normUrl(url))) return true;
      return isContextuallyGroundedUrl(url, ctx.userInput, ctx.knownUrls);
    },
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
      additionalProperties: false,
    },
    async execute({ url }, { signal, emit }) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return {
          status: 0,
          contentType: null,
          truncated: false,
          error: "invalid URL",
        };
      }

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {
          status: 0,
          contentType: null,
          truncated: false,
          error: `refused scheme "${parsed.protocol}"`,
        };
      }

      if (allowedOrigins && !allowedOrigins.has(parsed.origin)) {
        return {
          status: 0,
          contentType: null,
          truncated: false,
          error: `origin "${parsed.origin}" is not in the allowlist`,
        };
      }

      emit({ phase: "request", url: parsed.toString() });

      let res: Response;
      try {
        res = await fetch(parsed.toString(), { signal });
      } catch (err) {
        if ((err as Error).name === "AbortError") throw err;
        // The browser collapses CORS / DNS / network failures into one
        // opaque `TypeError`. Keep the message short - it lives in the
        // conversation and is paid for on every subsequent turn.
        const isOpaqueFetchFailure = err instanceof TypeError;
        const message = isOpaqueFetchFailure
          ? `Browser refused cross-origin fetch from "${parsed.origin}" (CORS, DNS, or network). Tell the user the page can't be read from the browser; don't guess its contents.`
          : (err as Error).message;
        emit({
          phase: "blocked",
          reason: isOpaqueFetchFailure ? "cors_or_network" : "error",
        });
        return {
          status: 0,
          contentType: null,
          truncated: false,
          error: message,
        };
      }

      emit({ phase: "received", status: res.status });

      const contentType = res.headers.get("content-type");
      const buf = await res.arrayBuffer();
      const rawTruncated = buf.byteLength > maxBytes;
      const view = new Uint8Array(buf.slice(0, maxBytes));
      const rawText = new TextDecoder().decode(view);

      if (contentType?.includes("application/json")) {
        emit({ phase: "parsed", format: "json" });
        try {
          return {
            status: res.status,
            contentType,
            truncated: rawTruncated,
            format: "json",
            body: JSON.parse(rawText),
          };
        } catch {
          return {
            status: res.status,
            contentType,
            truncated: rawTruncated,
            format: "text",
            text: rawText,
          };
        }
      }

      if (
        contentType?.includes("text/html") ||
        contentType?.includes("application/xhtml")
      ) {
        const article = extractReadableText(rawText);
        const capped =
          article.length > maxArticleChars
            ? article.slice(0, maxArticleChars)
            : article;
        emit({ phase: "extracted", chars: capped.length });
        return {
          status: res.status,
          contentType,
          truncated: rawTruncated || article.length > maxArticleChars,
          format: "article",
          text: capped,
        };
      }

      emit({
        phase: "decoded",
        bytes: view.byteLength,
        truncated: rawTruncated,
      });
      return {
        status: res.status,
        contentType,
        truncated: rawTruncated,
        format: "text",
        text: rawText,
      };
    },
  };
}

const NOISE_SELECTOR =
  "script, style, noscript, nav, header, footer, aside, form, svg, iframe, button, template";

/**
 * Reduce an HTML string to clean, structured reading text. Parses into
 * an inert document, strips chrome/noise, walks the main content
 * container in document order, and emits markdown-ish text where the
 * heading hierarchy is preserved (so section titles like "Vocabulary"
 * stay legible to the model). A `Sections:` outline of the h2/h3
 * headings is pinned to the top so the document's structure survives
 * even if the body is later truncated for context.
 */
function extractReadableText(html: string): string {
  if (typeof DOMParser === "undefined") {
    // Non-browser fallback: crude tag strip.
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(NOISE_SELECTOR).forEach((el) => {
    el.remove();
  });

  const title = collapse(doc.querySelector("title")?.textContent ?? "");
  const root =
    doc.querySelector("article") ||
    doc.querySelector("main") ||
    doc.querySelector("[role='main']") ||
    doc.body;

  const parts: string[] = [];
  if (title) parts.push(`# ${title}`);

  if (root) {
    // Outline first: guarantees section names are visible even when the
    // body gets truncated downstream.
    const sectionHeadings = Array.from(root.querySelectorAll("h2, h3"))
      .map((h) => collapse(h.textContent ?? ""))
      .filter(Boolean);
    if (sectionHeadings.length > 0) {
      parts.push(`Sections: ${sectionHeadings.join(" · ")}`);
    }

    for (const el of Array.from(
      root.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, blockquote, pre"),
    )) {
      const tag = el.tagName.toLowerCase();
      const value = collapse(el.textContent ?? "");
      if (!value) continue;
      if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag.charAt(1));
        parts.push(`${"#".repeat(level)} ${value}`);
      } else if (tag === "li") {
        parts.push(`- ${value}`);
      } else if (tag === "blockquote") {
        parts.push(`> ${value}`);
      } else {
        parts.push(value);
      }
    }
  }

  return parts.join("\n");
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
