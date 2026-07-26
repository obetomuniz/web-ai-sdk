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

function stabilizeMarkdown(content: string): string {
  // A streamed list item or emphasis marker can briefly look like a thematic
  // break (`***`) or an empty block. Keep syntax-only tails out of the parser
  // until the model provides semantic content.
  const stableContent = trailingMarkdownSyntax.test(content)
    ? content.replace(trailingMarkdownSyntax, "")
    : content;

  // Complete unterminated inline syntax so the same semantic element remains
  // mounted as its text grows instead of changing from plain text to Markdown.
  // Run complete responses through the same idempotent normalization too. That
  // prevents the parser input from changing pipelines at the exact moment a
  // streamed response becomes persisted.
  return remend(stableContent, { linkMode: "text-only" });
}

function MessageContentImpl({ content, streaming }: Props) {
  if (!content) {
    return streaming ? <ThinkingIndicator /> : null;
  }
  const renderedContent = stabilizeMarkdown(content);

  return (
    <div className={ui.answerMarkdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {renderedContent}
      </ReactMarkdown>
    </div>
  );
}

export const MessageContent = memo(MessageContentImpl);
