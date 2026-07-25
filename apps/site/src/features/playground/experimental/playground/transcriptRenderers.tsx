import type { ReactElement } from "react";
import { MessageContent } from "../../components/MessageContent.js";
import { ResponseActions } from "./ResponseActions.js";

export type TranscriptRendererId = "react-markdown";

export interface TranscriptRenderProps {
  content: string;
  streaming: boolean;
  showActions: boolean;
  durationMs?: number;
}

type TranscriptRenderer = (props: TranscriptRenderProps) => ReactElement | null;

const renderers: Record<TranscriptRendererId, TranscriptRenderer> = {
  "react-markdown": ({ content, streaming, showActions, durationMs }) => (
    <>
      <MessageContent content={content} streaming={streaming} />
      {showActions && (
        <ResponseActions
          content={content}
          streaming={streaming}
          durationMs={durationMs}
        />
      )}
    </>
  ),
};

export function resolveTranscriptRenderer(
  id?: TranscriptRendererId,
): TranscriptRenderer {
  return id ? renderers[id] : renderers["react-markdown"];
}
