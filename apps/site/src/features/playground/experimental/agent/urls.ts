/** Extract HTTP(S) URLs from free-text input. Conservative on purpose. */
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>'"`]+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Resolve an unambiguous resource continuation against the most recently
 * fetched URL. This is deliberately provider-agnostic: a slash-delimited
 * identifier replaces the same number of trailing path segments, while a
 * single explicit identifier replaces the last path segment (or the sole
 * query value). The candidate still has to pass the contextual grounding
 * policy below before it can be fetched.
 */
export function resolveContextualUrls(
  text: string,
  previouslyFetchedUrls: readonly string[],
): string[] {
  const directUrls = extractUrls(text);
  if (directUrls.length > 0) return directUrls;

  const previous = [...previouslyFetchedUrls]
    .reverse()
    .map(parseHttpUrl)
    .find((url): url is URL => Boolean(url));
  if (!previous) return [];

  const pathReference = text.match(
    /(?:^|\s)([a-z\d._~-]+(?:\/[a-z\d._~-]+)+)(?=$|[\s,.;:!?])/i,
  )?.[1];
  const candidate = pathReference
    ? replacePathSuffix(previous, pathReference.split("/"))
    : replaceScalarResource(previous, contextualScalar(text, previous));
  if (!candidate) return [];

  const known = new Set(previouslyFetchedUrls.map(normUrl));
  return isContextuallyGroundedUrl(candidate.toString(), text, known)
    ? [candidate.toString()]
    : [];
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

/**
 * Validate a model-proposed follow-up URL against resources already fetched
 * in this conversation. This is provider-agnostic: the destination must stay
 * on a known origin and route shape, while every changed resource component
 * must appear explicitly in the user's follow-up. Reusing an exact known URL
 * is also safe (for questions such as "what does that field mean?").
 */
export function isContextuallyGroundedUrl(
  candidate: string,
  userInput: string,
  previouslyFetchedUrls: ReadonlySet<string>,
): boolean {
  const parsedCandidate = parseHttpUrl(candidate);
  if (!parsedCandidate) return false;
  const normalizedCandidate = normUrl(parsedCandidate.toString());
  if (previouslyFetchedUrls.has(normalizedCandidate)) return true;

  for (const previous of previouslyFetchedUrls) {
    const parsedPrevious = parseHttpUrl(previous);
    if (!parsedPrevious || parsedCandidate.origin !== parsedPrevious.origin) {
      continue;
    }

    const previousPath = pathSegments(parsedPrevious);
    const candidatePath = pathSegments(parsedCandidate);
    const sharesRoute = sharesRoutePrefix(previousPath, candidatePath);
    if (!sharesRoute && parsedCandidate.pathname !== parsedPrevious.pathname) {
      continue;
    }

    const changed = changedResourceComponents(parsedPrevious, parsedCandidate);
    if (
      changed.length > 0 &&
      changed.every((component) =>
        userInput.toLocaleLowerCase().includes(component.toLocaleLowerCase()),
      )
    ) {
      return true;
    }
  }

  return false;
}

function sharesRoutePrefix(
  previousPath: readonly string[],
  candidatePath: readonly string[],
): boolean {
  if (
    previousPath.length === 0 ||
    previousPath.length !== candidatePath.length
  ) {
    return false;
  }

  const firstChanged = candidatePath.findIndex(
    (segment, index) => segment !== previousPath[index],
  );
  return firstChanged > 0;
}

function parseHttpUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

function pathSegments(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean).map(decodeUrlComponent);
}

function decodeUrlComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function changedResourceComponents(previous: URL, candidate: URL): string[] {
  const previousPath = pathSegments(previous);
  const candidatePath = pathSegments(candidate);
  const changedPath = candidatePath.filter(
    (segment, index) => segment !== previousPath[index],
  );
  const changedQuery = Array.from(candidate.searchParams, ([key, value]) =>
    previous.searchParams.getAll(key).includes(value) ? undefined : value,
  ).filter((value): value is string => Boolean(value));
  return [...changedPath, ...changedQuery];
}

function replacePathSuffix(previous: URL, replacement: string[]): URL | null {
  const previousPath = pathSegments(previous);
  if (replacement.length === 0 || previousPath.length <= replacement.length) {
    return null;
  }
  const candidate = new URL(previous);
  candidate.pathname = `/${[
    ...previousPath.slice(0, -replacement.length),
    ...replacement,
  ]
    .map(encodeURIComponent)
    .join("/")}`;
  candidate.search = "";
  candidate.hash = "";
  return candidate;
}

function replaceScalarResource(previous: URL, resource?: string): URL | null {
  if (!resource) return null;
  const candidate = new URL(previous);
  const queryEntries = Array.from(candidate.searchParams);
  if (queryEntries.length === 1) {
    if (!sameIdentifierShape(queryEntries[0]?.[1] ?? "", resource)) {
      return null;
    }
    candidate.searchParams.set(queryEntries[0]?.[0] ?? "", resource);
    candidate.hash = "";
    return candidate;
  }

  const previousPath = pathSegments(previous);
  if (previousPath.length < 2) return null;
  if (!sameIdentifierShape(previousPath.at(-1) ?? "", resource)) return null;
  previousPath[previousPath.length - 1] = resource;
  candidate.pathname = `/${previousPath.map(encodeURIComponent).join("/")}`;
  candidate.search = "";
  candidate.hash = "";
  return candidate;
}

function contextualScalar(text: string, previous: URL): string | undefined {
  const followUp =
    text.match(/^\s*now(?:\s+(?:from|for|about))?\s+(.+?)\s*[?.!]*$/i)?.[1] ??
    text.match(/^\s*(?:what|how)\s+about\s+(.+?)\s*[?.!]*$/i)?.[1] ??
    text.match(
      /^\s*(?:same|instead)(?:\s+\w+){0,3}\s+(?:for|with)\s+(.+?)\s*[?.!]*$/i,
    )?.[1];
  if (!followUp) return undefined;

  const tokens = followUp.match(/[a-z\d._~-]+/gi) ?? [];
  const ignored = new Set([
    "a",
    "about",
    "an",
    "another",
    "for",
    "from",
    "item",
    "one",
    "other",
    "project",
    "repo",
    "repository",
    "resource",
    "the",
  ]);
  const routeLabels = new Set(
    pathSegments(previous)
      .slice(0, -1)
      .flatMap((segment) => {
        const normalized = segment.toLocaleLowerCase();
        return [normalized, normalized.replace(/s$/, "")];
      }),
  );
  const candidates = tokens.filter((token) => {
    const normalized = token.toLocaleLowerCase();
    return !ignored.has(normalized) && !routeLabels.has(normalized);
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}

function sameIdentifierShape(previous: string, next: string): boolean {
  if (/^\d+$/.test(previous)) return /^\d+$/.test(next);
  if (/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(previous)) {
    return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(next);
  }
  return true;
}
