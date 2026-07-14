import type { ReactElement } from "react";
import { MessageContent } from "../../components/MessageContent.js";
import { StreamStats } from "./StreamStats.js";

export type TranscriptRendererId = "react-markdown";

export interface TranscriptRenderProps {
  content: string;
  streaming: boolean;
}

type TranscriptRenderer = (props: TranscriptRenderProps) => ReactElement | null;

const renderers: Record<TranscriptRendererId, TranscriptRenderer> = {
  "react-markdown": ({ content, streaming }) => (
    // Stream as plain text (cheap), then finalize to markdown once the
    // stream settles. Avoids re-parsing the whole answer with
    // react-markdown + remark-gfm on every animation frame - the dominant
    // per-frame cost during token streaming. Mirrors the main chat and the
    // playground's "lighter streaming path" design decision.
    <>
      <MessageContent
        content={content}
        streaming={streaming}
        streamingRenderMode="plain"
      />
      <StreamStats content={content} streaming={streaming} />
    </>
  ),
};

export function resolveTranscriptRenderer(
  id?: TranscriptRendererId,
): TranscriptRenderer {
  return id ? renderers[id] : renderers["react-markdown"];
}
