import {
  type ComponentType,
  type KeyboardEvent,
  useEffect,
  useState,
} from "react";
import {
  pkgActions,
  pkgBullets,
  pkgDocs,
  pkgInstall,
  pkgInstallPkg,
  pkgInstallPrompt,
  pkgLeft,
  pkgName,
  pkgPanel,
  pkgRight,
  pkgTag,
  scope,
  silverText,
  tab,
  tabActive,
  tabPackageIcon,
  tabPackageIconMotion,
  tabsFlush,
} from "../../../shared/ui.js";
import { DetectorDemo } from "./DetectorDemo.js";
import { PromptDemo } from "./PromptDemo.js";
import { ProofreaderDemo } from "./ProofreaderDemo.js";
import { RewriterDemo } from "./RewriterDemo.js";
import { SummarizerDemo } from "./SummarizerDemo.js";
import { TranslatorDemo } from "./TranslatorDemo.js";
import { WebMCPDemo } from "./WebMCPDemo.js";
import { WriterDemo } from "./WriterDemo.js";

/**
 * Tabbed package explorer: a tab strip plus a single visible package panel
 * (copy left, live demo right), replacing the eight formerly stacked blocks.
 * All eight copy panels render in the SSR output (inactive ones carry the
 * `hidden` attribute) so every package's copy stays in the built HTML; only
 * the active tab's demo mounts, one at a time.
 */

interface PackageInfo {
  slug: string;
  title: string;
  tag: string;
  bullets: [string, string][];
}

const PACKAGE_ROWS: PackageInfo[] = [
  {
    slug: "prompt",
    title: "prompt",
    tag: "Talk to the on-device language model. Sessions, streaming, and AbortSignals; done.",
    bullets: [
      [
        "Session reuse.",
        "Cached by config so re-renders do not churn the model.",
      ],
      [
        "Streaming first.",
        "AsyncIterable out of the box; React hook gives you a string.",
      ],
      [
        "Clean lifecycle.",
        "AbortController on unmount, retry on session-lost.",
      ],
    ],
  },
  {
    slug: "webmcp",
    title: "webmcp",
    tag: "Register tools the browser's model context can call. Real agents, real cleanup, no boilerplate.",
    bullets: [
      [
        "Declarative tools.",
        "Register from React; AbortSignal cleanup on unmount.",
      ],
      [
        "Last writer wins.",
        "Re-registers on hot reload without duplicate errors.",
      ],
      [
        "SDK-first surface.",
        "Register, discover, and execute without raw browser globals.",
      ],
    ],
  },
  {
    slug: "summarizer",
    title: "summarizer",
    tag: "Key-points, TL;DR, headlines. Configurable type and length.",
    bullets: [
      ["Four shapes.", "key-points, tl;dr, teaser, headline."],
      [
        "Three lengths.",
        "short, medium, long. Deterministic with the same seed.",
      ],
      ["Streaming summaries.", "Pipe chunks straight into your UI."],
    ],
  },
  {
    slug: "translator",
    title: "translator",
    tag: "Pair-based translation with block-level round-trip. Walks the DOM, swaps text, keeps markup intact.",
    bullets: [
      [
        "Pair caching.",
        "Sessions cached per source to target pair. Switching is instant.",
      ],
      [
        "Block round-trip.",
        "Walks the DOM, swaps text, keeps the markup intact.",
      ],
      ["Graceful fallback.", "No-op fallback when the API is missing."],
    ],
  },
  {
    slug: "detector",
    title: "detector",
    tag: "Detect the language of any text on-device. Returns BCP-47 codes with confidence scores.",
    bullets: [
      [
        "Top candidate or full list.",
        "Use the best guess, or inspect every alternate above your threshold.",
      ],
      [
        "Bias hints.",
        "Pass expectedInputLanguages to break ties between similar languages.",
      ],
      [
        "Wire the others.",
        "Detect first, then summarize, translate, or prompt with the result.",
      ],
    ],
  },
  {
    slug: "writer",
    title: "writer",
    tag: "Draft new content from a task description. Tone, format, length; streamed straight into your UI.",
    bullets: [
      [
        "Task in, prose out.",
        "Give it a prompt; get back a paragraph, email, or post.",
      ],
      [
        "Tone and length.",
        "formal, neutral, casual, across short, medium, and long.",
      ],
      [
        "Markdown safe.",
        "Trims edges only, so formatting and line breaks survive.",
      ],
    ],
  },
  {
    slug: "rewriter",
    title: "rewriter",
    tag: "Tone-shift and reshape text you already have. More formal, shorter, or longer; one call.",
    bullets: [
      [
        "Relative adjustments.",
        "more-formal, more-casual, shorter, longer, as-is.",
      ],
      [
        "Streaming first.",
        "Pipe the revised text in as the model produces it.",
      ],
      [
        "Same lifecycle.",
        "Session reuse, AbortSignals, opt-in caching; shared with Writer.",
      ],
    ],
  },
  {
    slug: "proofreader",
    title: "proofreader",
    tag: "Grammar, spelling, and punctuation fixes with per-issue offsets you can highlight in place.",
    bullets: [
      [
        "Corrected text and diffs.",
        "Get the clean string and the list of edits with offsets.",
      ],
      [
        "Highlight inline.",
        "Offsets index the original input, so you can mark each error in place.",
      ],
      [
        "One-shot.",
        "No streaming; resolves once with the full result and optional caching.",
      ],
    ],
  },
];

// Descriptive docs anchor text per package. Lead with "web-ai-sdk" so the link
// clearly points at our SDK guide (not the official browser API docs) and
// reinforces the brand entity in internal anchor text.
const PACKAGE_DOCS_LABELS: Record<string, string> = {
  prompt: "web-ai-sdk Prompt API docs",
  webmcp: "web-ai-sdk WebMCP docs",
  summarizer: "web-ai-sdk Summarizer API docs",
  translator: "web-ai-sdk Translator API docs",
  detector: "web-ai-sdk Language Detector API docs",
  writer: "web-ai-sdk Writer API docs",
  rewriter: "web-ai-sdk Rewriter API docs",
  proofreader: "web-ai-sdk Proofreader API docs",
};

// One distinct icon per primitive (lucide line-art, inner markup only; the
// shared <svg> wrapper sets size, stroke, and currentColor). Static, authored
// content rendered via dangerouslySetInnerHTML, so no untrusted-HTML concern.
const PACKAGE_ICONS: Record<string, string> = {
  prompt: `<path pathLength="1" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  webmcp: `<rect pathLength="1" width="7" height="7" x="3" y="3" rx="1"/><rect pathLength="1" width="7" height="7" x="14" y="3" rx="1"/><rect pathLength="1" width="7" height="7" x="14" y="14" rx="1"/><rect pathLength="1" width="7" height="7" x="3" y="14" rx="1"/>`,
  summarizer: `<line pathLength="1" x1="21" x2="3" y1="6" y2="6"/><line pathLength="1" x1="15" x2="3" y1="12" y2="12"/><line pathLength="1" x1="17" x2="3" y1="18" y2="18"/>`,
  translator: `<g class="translator-source"><path pathLength="1" d="m5 8 6 6"/><path pathLength="1" d="m4 14 6-6 2-3"/><path pathLength="1" d="M2 5h12"/><path pathLength="1" d="M7 2h1"/></g><g class="translator-target"><path pathLength="1" d="m22 22-5-10-5 10"/><path pathLength="1" d="M14 18h6"/></g>`,
  detector: `<circle pathLength="1" cx="11" cy="11" r="8"/><path pathLength="1" d="m21 21-4.3-4.3"/>`,
  writer: `<path pathLength="1" d="M12 20h9"/><path pathLength="1" d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>`,
  rewriter: `<path pathLength="1" d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path pathLength="1" d="m18 2 4 4-4 4"/><path pathLength="1" d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path pathLength="1" d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path pathLength="1" d="m18 14 4 4-4 4"/>`,
  proofreader: `<circle pathLength="1" cx="12" cy="12" r="10"/><path pathLength="1" d="m9 12 2 2 4-4"/>`,
};

const DEMOS: Record<string, ComponentType> = {
  prompt: PromptDemo,
  webmcp: WebMCPDemo,
  summarizer: SummarizerDemo,
  translator: TranslatorDemo,
  detector: DetectorDemo,
  writer: WriterDemo,
  rewriter: RewriterDemo,
  proofreader: ProofreaderDemo,
};

const baseUrl = new URL(import.meta.env.BASE_URL, "https://web-ai-sdk.dev");
const guideLink = (slug: string) =>
  new URL(`docs/guides/${slug}/`, baseUrl).pathname;

const FIRST_PKG =
  PACKAGE_ROWS[0] ??
  raise("PackageExplorer: PACKAGE_ROWS must contain at least one entry");

function raise(message: string): never {
  throw new Error(message);
}

export const PackageExplorer = () => {
  const [slug, setSlug] = useState(FIRST_PKG.slug);

  // Hash support (shareability, not compatibility: nothing links to the old
  // per-slug anchors). On mount and on hashchange, a hash matching a slug
  // selects that tab; clicking a tab replaces the hash without a history
  // entry. Runs only in effects, so SSR never touches window.
  useEffect(() => {
    const applyHash = () => {
      const candidate = window.location.hash.slice(1);
      if (PACKAGE_ROWS.some((p) => p.slug === candidate)) setSlug(candidate);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const select = (next: string) => {
    setSlug(next);
    history.replaceState(null, "", `#${next}`);
  };

  const onTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % PACKAGE_ROWS.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + PACKAGE_ROWS.length) % PACKAGE_ROWS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = PACKAGE_ROWS.length - 1;
        break;
      default:
        return;
    }

    const next = PACKAGE_ROWS[nextIndex];
    if (!next) return;

    event.preventDefault();
    select(next.slug);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#pkg-tab-${next.slug}`)
      ?.focus();
  };

  return (
    <div>
      <div
        className={tabsFlush}
        role="tablist"
        aria-label="web-ai-sdk packages"
        aria-orientation="horizontal"
      >
        {PACKAGE_ROWS.map((p, index) => (
          <button
            key={p.slug}
            type="button"
            role="tab"
            id={`pkg-tab-${p.slug}`}
            aria-selected={p.slug === slug}
            aria-controls={`pkg-panel-${p.slug}`}
            tabIndex={p.slug === slug ? 0 : -1}
            className={p.slug === slug ? tabActive : tab}
            onClick={() => select(p.slug)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            <svg
              className={`${tabPackageIcon} ${p.slug === slug ? "" : (tabPackageIconMotion[p.slug as keyof typeof tabPackageIconMotion] ?? "")}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: static, authored icon markup
              dangerouslySetInnerHTML={{
                __html: PACKAGE_ICONS[p.slug] ?? "",
              }}
            />
            {p.title}
          </button>
        ))}
      </div>
      {PACKAGE_ROWS.map((p) => {
        const active = p.slug === slug;
        const Demo = DEMOS[p.slug];
        return (
          <div
            key={p.slug}
            role="tabpanel"
            id={`pkg-panel-${p.slug}`}
            aria-labelledby={`pkg-tab-${p.slug}`}
            hidden={!active}
            className={pkgPanel}
          >
            <div className={pkgLeft}>
              <div className={pkgName}>
                <span className={scope}>@web-ai-sdk/</span>
                {p.title}
              </div>
              <div className={pkgTag}>{p.tag}</div>
              <ul className={pkgBullets}>
                {p.bullets.map(([strong, text]) => (
                  <li key={strong}>
                    <span>
                      <b>{strong}</b> {text}
                    </span>
                  </li>
                ))}
              </ul>
              <div className={pkgActions}>
                <code className={pkgInstall}>
                  <span className={pkgInstallPrompt}>$</span> npm install{" "}
                  <span className={pkgInstallPkg}>@web-ai-sdk/{p.title}</span>
                </code>
                <a className={pkgDocs} href={guideLink(p.slug)}>
                  <span className={silverText}>
                    {PACKAGE_DOCS_LABELS[p.slug] ?? "Read the docs"}
                  </span>
                </a>
              </div>
            </div>
            <div className={pkgRight}>{active && Demo ? <Demo /> : null}</div>
          </div>
        );
      })}
    </div>
  );
};
