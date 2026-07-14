/** Extract HTTP(S) URLs from free-text input. Conservative on purpose. */
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>'"`]+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/** Normalize a URL for matching (trailing slash / trailing punctuation). */
export function normUrl(u: string): string {
  return u
    .trim()
    .replace(/[).,;]+$/, "")
    .replace(/\/+$/, "");
}

export function userUrlSet(input: string): ReadonlySet<string> {
  return new Set(extractUrls(input).map(normUrl));
}
