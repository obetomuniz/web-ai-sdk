import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { playground as ui } from "../../../shared/ui.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";

interface Props {
  content: string;
  streaming?: boolean;
  /**
   * While streaming, render as plain text instead of reparsing markdown on
   * every token. This makes long responses feel much smoother. Final render
   * still uses markdown once streaming ends.
   */
  streamingRenderMode?: "markdown" | "plain";
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

function MessageContentImpl({
  content,
  streaming,
  streamingRenderMode = "markdown",
}: Props) {
  if (!content) {
    return streaming ? <ThinkingIndicator /> : null;
  }
  if (streaming && streamingRenderMode === "plain") {
    return (
      <div className={`${ui.answerMarkdown} ${ui.markdownStream}`}>
        {content}
        <span className="ml-1 inline-block h-[0.9em] w-[0.45em] animate-blink rounded-[1px] bg-accent align-middle" />
      </div>
    );
  }
  return (
    <div className={ui.answerMarkdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="ml-1 inline-block h-[0.9em] w-[0.45em] animate-blink rounded-[1px] bg-accent align-middle" />
      )}
    </div>
  );
}

export const MessageContent = memo(MessageContentImpl);
