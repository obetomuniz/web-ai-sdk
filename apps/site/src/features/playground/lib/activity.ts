const LEADING_MARKDOWN = /^(?:#{1,6}|[-+*>])\s+/;
const STRONG_MARKDOWN = /(\*\*|__)(.*?)\1/g;
const INLINE_CODE_MARKDOWN = /`([^`]+)`/g;

/** Turn Markdown output into a concise plain-text Activity preview. */
export function activityPreview(text: string, fallback: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return fallback;

  return (
    firstLine
      .replace(LEADING_MARKDOWN, "")
      .replace(STRONG_MARKDOWN, "$2")
      .replace(INLINE_CODE_MARKDOWN, "$1")
      .trim() || fallback
  );
}
