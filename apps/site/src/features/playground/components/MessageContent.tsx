import { memo, useDeferredValue } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { playground as ui } from "../../../shared/ui.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";

interface Props {
  content: string;
  streaming?: boolean;
}

const components: Components = {
  a: ({ href, children, ...rest }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" {...rest}>
      {children}
    </a>
  ),
  code: ({ className, children, ...rest }) => {
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

function MessageContentImpl({ content, streaming }: Props) {
  // Keep one semantic renderer for the response's entire lifetime. React may
  // skip superseded token-level parses while generation is busy, but the DOM
  // never swaps from a whitespace-preserving tree to a Markdown tree when the
  // response settles.
  const deferredContent = useDeferredValue(content);
  const renderedContent = streaming ? deferredContent || content : content;

  if (!content) {
    return streaming ? <ThinkingIndicator /> : null;
  }
  return (
    <div className={ui.answerMarkdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {renderedContent}
      </ReactMarkdown>
    </div>
  );
}

export const MessageContent = memo(MessageContentImpl);
