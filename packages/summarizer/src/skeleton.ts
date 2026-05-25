/** Internal output normalization for `summarize()`. */

/** Strip wrapping quotes / whitespace and collapse internal whitespace. */
export const cleanSummary = (raw: string): string =>
  raw
    .replace(/^["“”'`\s]+|["“”'`\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
