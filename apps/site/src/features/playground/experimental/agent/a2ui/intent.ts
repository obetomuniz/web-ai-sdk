/** Tools that do not disable `responseConstraint` on UI turns. */
const A2UI_NONBLOCKING_TOOLS = new Set(["clock_now"]);

export function toolsCompatibleWithA2uiConstraint(
  tools: ReadonlyArray<{ name: string }>,
): boolean {
  return tools.every((t) => A2UI_NONBLOCKING_TOOLS.has(t.name));
}

/** Heuristic: user asked for a generative UI surface (not plain Q&A). */
export function userWantsA2uiUi(input: string): boolean {
  const t = input.toLowerCase();
  if (/\b(no ui|plain text|in prose|markdown only|without ui)\b/.test(t)) {
    return false;
  }
  return /\b(ui|card|chart|graph|dashboard|stats?|metrics?|kpi|bar|button|layout|welcome|screen|surface|status)\b/.test(
    t,
  );
}
