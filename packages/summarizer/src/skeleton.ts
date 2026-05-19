/**
 * Build a high-signal "skeleton" of a long article so the model gets a tight
 * input instead of the full body. The skeleton is the title, description, and
 * every heading + `<strong>`/`<b>` inside the article; the chunks a human
 * skims to grasp the post.
 *
 * Duplicate phrases (a heading repeated as bold inside a paragraph) are
 * collapsed via a Set so the skeleton stays compact.
 */

export interface BuildSkeletonOptions {
  /** Element whose contents are walked for headings + bolds. */
  article: Element;
  /** Optional title; pushed as the first line of the skeleton. */
  title?: string;
  /** Optional description; pushed as the second line. */
  description?: string;
  /**
   * CSS selector for the elements whose `innerText` becomes the skeleton.
   * Default: `"h1, h2, h3, h4, strong, b"`.
   */
  selector?: string;
}

const DEFAULT_SELECTOR = "h1, h2, h3, h4, strong, b";

const innerTextOf = (el: Element): string => {
  if ("innerText" in el && typeof (el as HTMLElement).innerText === "string") {
    return (el as HTMLElement).innerText;
  }
  return el.textContent ?? "";
};

export const buildSkeleton = ({
  article,
  title,
  description,
  selector = DEFAULT_SELECTOR,
}: BuildSkeletonOptions): string => {
  const parts: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string | null | undefined): void => {
    if (!raw) return;
    const clean = raw.replace(/\s+/g, " ").trim();
    if (clean.length < 3) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(clean);
  };

  push(title);
  push(description);

  for (const el of article.querySelectorAll<Element>(selector)) {
    push(innerTextOf(el));
  }

  return parts.join(". ");
};

/**
 * Cap text length without cutting mid-sentence. Looks for the last sentence
 * terminator inside the kept slice; falls back to a hard cut if none is found
 * in the last 40% of the budget.
 */
export const trimToSentenceBoundary = (
  text: string,
  maxChars: number,
): string => {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastBoundary = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("\n"),
  );
  if (lastBoundary > maxChars * 0.6) return slice.slice(0, lastBoundary + 1);
  return slice;
};

/** Strip wrapping quotes / whitespace and collapse internal whitespace. */
export const cleanSummary = (raw: string): string =>
  raw
    .replace(/^["“”'`\s]+|["“”'`\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
