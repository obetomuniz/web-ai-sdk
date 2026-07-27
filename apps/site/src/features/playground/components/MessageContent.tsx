import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remend from "remend";
import { playground as ui } from "../../../shared/ui.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";

interface Props {
  content: string;
  streaming?: boolean;
}

const components: Components = {
  a: ({ href, children, node: _node, ...rest }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" {...rest}>
      {children}
    </a>
  ),
  code: ({ className, children, node: _node, ...rest }) => {
    const isBlock = /\blanguage-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code className={ui.markdownInlineCode} {...rest}>
        {children}
      </code>
    );
  },
};

const trailingMarkdownSyntax = /(?:^|\n)(?:\s|[-+*>#_~`[\]()])+$/;
const listMarkerWithExtraSpacing = /^(\s*(?:[-+*]|\d+[.)]))[ \t]{2,}(?=\S)/;
const fencedCodeBoundary = /^\s*(`{3,}|~{3,})/;

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

function MessageContentImpl({ content, streaming }: Props) {
  if (!content) {
    return streaming ? <ThinkingIndicator /> : null;
  }
  const renderedContent = streaming
    ? stabilizeMarkdown(content)
    : normalizeListMarkerSpacing(content);

  return (
    <div className={ui.answerMarkdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {renderedContent}
      </ReactMarkdown>
    </div>
  );
}

export const MessageContent = memo(MessageContentImpl);
