import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remend from "remend";

interface ModelMarkdownProps {
  content: string;
  streaming?: boolean;
  className?: string;
  inlineCodeClassName?: string;
}

const trailingMarkdownSyntax = /(?:^|\n)(?:\s|[-+*>#_~`[\]()])+$/;
const listMarkerWithExtraSpacing = /^(\s*(?:[-+*]|\d+[.)]))[ \t]{2,}(?=\S)/;
const fencedCodeBoundary = /^\s*(`{3,}|~{3,})/;
const safeLinkProtocols = new Set(["http:", "https:", "mailto:"]);
const linkUrlBase = "https://model-output.invalid";
// Keep this default-deny set aligned with `safeMarkdownTags` in
// `features/playground/PlaygroundFallback.astro`.
const allowedModelMarkdownElements = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
] as const;

function normalizeListMarkerSpacing(content: string): string {
  let fence: { character: string; length: number } | undefined;

  return content
    .split("\n")
    .map((line) => {
      const boundary = line.match(fencedCodeBoundary)?.[1];
      if (boundary) {
        if (!fence) {
          fence = { character: boundary[0] ?? "", length: boundary.length };
        } else if (
          boundary[0] === fence.character &&
          boundary.length >= fence.length
        ) {
          fence = undefined;
        }
        return line;
      }

      return fence ? line : line.replace(listMarkerWithExtraSpacing, "$1 ");
    })
    .join("\n");
}

function stabilizeMarkdown(content: string): string {
  // A streamed list item or emphasis marker can briefly look like a thematic
  // break (`***`) or an empty block. Keep syntax-only tails out of the parser
  // until the model provides semantic content.
  const stableContent = trailingMarkdownSyntax.test(content)
    ? content.replace(trailingMarkdownSyntax, "")
    : content;

  // Complete unterminated inline syntax so the same semantic element remains
  // mounted as its text grows instead of changing from plain text to Markdown.
  // Persisted responses bypass this repair step because they already contain
  // complete Markdown, and repairing valid nested lists can change their tree.
  return remend(normalizeListMarkerSpacing(stableContent), {
    linkMode: "text-only",
  });
}

/**
 * Model-authored links are untrusted. Resolve against an HTTPS base so relative
 * URLs stay useful, then allow only the same protocols as the static fallback
 * renderer. Returning an empty string leaves unsafe Markdown links without an
 * executable `href`.
 */
export function secureModelUrl(url: string): string {
  try {
    const resolved = new URL(url, linkUrlBase);
    return safeLinkProtocols.has(resolved.protocol) ? url : "";
  } catch {
    return "";
  }
}

/**
 * Render untrusted model Markdown as a React tree. Raw HTML stays disabled;
 * callers must pass the complete accumulated stream buffer on every update so
 * split Markdown constructs are stabilized and re-evaluated together.
 */
export function ModelMarkdown({
  content,
  streaming = false,
  className,
  inlineCodeClassName,
}: ModelMarkdownProps) {
  const components = useMemo<Components>(
    () => ({
      a: ({ href, children, node: _node, ...rest }) => (
        <a
          {...rest}
          {...(href ? { href } : {})}
          target="_blank"
          rel="noreferrer noopener"
        >
          {children}
        </a>
      ),
      code: ({ className: codeClassName, children, node: _node, ...rest }) => {
        const isBlock = /\blanguage-/.test(codeClassName ?? "");
        if (isBlock || !inlineCodeClassName) {
          return (
            <code className={codeClassName} {...rest}>
              {children}
            </code>
          );
        }
        return (
          <code className={inlineCodeClassName} {...rest}>
            {children}
          </code>
        );
      },
    }),
    [inlineCodeClassName],
  );
  const renderedContent = streaming
    ? stabilizeMarkdown(content)
    : normalizeListMarkerSpacing(content);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        allowedElements={allowedModelMarkdownElements}
        skipHtml
        urlTransform={secureModelUrl}
      >
        {renderedContent}
      </ReactMarkdown>
    </div>
  );
}
