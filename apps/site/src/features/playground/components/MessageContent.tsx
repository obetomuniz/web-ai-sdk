import { memo } from "react";
import { ModelMarkdown } from "../../../shared/components/ModelMarkdown.js";
import { playground as ui } from "../../../shared/ui.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";

interface Props {
  content: string;
  streaming?: boolean;
}

function MessageContentImpl({ content, streaming }: Props) {
  if (!content) {
    return streaming ? <ThinkingIndicator /> : null;
  }

  return (
    <ModelMarkdown
      content={content}
      streaming={streaming}
      className={ui.answerMarkdown}
      inlineCodeClassName={ui.markdownInlineCode}
    />
  );
}

export const MessageContent = memo(MessageContentImpl);
