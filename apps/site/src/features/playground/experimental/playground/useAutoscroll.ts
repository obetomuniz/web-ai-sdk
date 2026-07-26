/**
 * Playground autoscroll. Thin alias over the app-wide `useStickToBottom`
 * hook so the transcript + event log share the exact same "stick to the
 * bottom, but yield when the user scrolls up, and resume when they scroll
 * back down" behavior as the main chat. Returns `{ isPinned, scrollToBottom }`.
 */

export {
  type StickToBottom,
  useStickToBottom as useAutoscroll,
} from "../../lib/useStickToBottom.js";
