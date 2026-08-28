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
  pkgInstallCopy,
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
import type { DemoIntentProps } from "./shared.js";
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
    tag: "Send prompts and manage independent sessions, streams, and abort signals.",
    bullets: [
      ["Session reuse.", "Compatible calls reuse a cached base session."],
      [
        "Streaming first.",
        "Sessions yield deltas. ask() exposes cumulative text.",
      ],
      [
        "Clean lifecycle.",
        "Abort signals cancel runs. Leases release prepared sessions.",
      ],
    ],
  },
  {
    slug: "webmcp",
    title: "webmcp",
    tag: "Register tools for the browser's model context and clean them up safely.",
    bullets: [
      [
        "Declarative tools.",
        "Register typed tools and clean up with an AbortSignal.",
      ],
      [
        "Last writer wins.",
        "Re-registers on hot reload without duplicate errors.",
      ],
      [
        "SDK-first surface.",
        "Register, discover, and execute through typed functions.",
      ],
    ],
  },
  {
    slug: "summarizer",
    title: "summarizer",
    tag: "Key-points, TL;DR, headlines. Configurable type and length.",
    bullets: [
      ["Four shapes.", "key-points, tl;dr, teaser, headline."],
      ["Three lengths.", "Choose short, medium, or long output."],
      [
        "Streaming summaries.",
        "Receive cumulative text as the model responds.",
      ],
    ],
  },
  {
    slug: "translator",
    title: "translator",
    tag: "Translate a string between a source and target language.",
    bullets: [
      ["Pair caching.", "Sessions are cached by source and target language."],
      ["Streaming first.", "Receive cumulative text as the model responds."],
      ["String input.", "The SDK does not walk or mutate the DOM."],
    ],
  },
  {
    slug: "detector",
    title: "detector",
    tag: "Detect the language of any text on-device. Returns BCP-47 codes with confidence scores.",
    bullets: [
      [
        "Top candidate or full list.",
        "Use the top result or inspect all results above a threshold.",
      ],
      [
        "Bias hints.",
        "Pass expectedInputLanguages when you know the likely languages.",
      ],
      [
        "Wire the others.",
        "Application code can pass the result to another capability.",
      ],
    ],
  },
  {
    slug: "writer",
    title: "writer",
    tag: "Draft text from a task description. Configure tone, format, and length.",
    bullets: [
      [
        "Task in, prose out.",
        "Pass a writing task and receive generated text.",
      ],
      ["Tone and length.", "Choose a tone and output length."],
      [
        "Output cleanup.",
        "The wrapper trims outer whitespace and preserves internal formatting.",
      ],
    ],
  },
  {
    slug: "rewriter",
    title: "rewriter",
    tag: "Change the tone or length of existing text.",
    bullets: [
      [
        "Relative adjustments.",
        "more-formal, more-casual, shorter, longer, as-is.",
      ],
      ["Streaming first.", "Receive cumulative text as the model responds."],
      [
        "Same lifecycle.",
        "Reuse sessions, abort work, and opt in to result caching.",
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

const DEMOS: Record<string, ComponentType<DemoIntentProps>> = {
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

/**
 * Per-demo install command with a click-to-copy CTA, the compact sibling of
 * the hero InstallPill: the whole command is one button, and the trailing
 * cue flips to "copied" for a beat after a successful copy.
 */
const InstallCommand = ({ pkg }: { pkg: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`npm install ${pkg}`);
    } catch {
      // Clipboard unavailable in some browsers / contexts; keep the resting
      // cue rather than claiming a copy happened.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button type="button" className={pkgInstall} onClick={copy}>
      <span className={pkgInstallPrompt}>$</span> npm install{" "}
      <span className={pkgInstallPkg}>{pkg}</span>
      <span className={`${pkgInstallCopy} ${copied ? "text-ok" : "text-fg-3"}`}>
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
};

function raise(message: string): never {
  throw new Error(message);
}

export const PackageExplorer = () => {
  const [slug, setSlug] = useState(FIRST_PKG.slug);
  // Intent gate for session preparation. Hydration and load-time hashes only
  // mount a demo; an in-page tab selection (click, keyboard, or a later hash
  // change) is the signal that lets the mounted demo prepare its capability.
  const [userSelected, setUserSelected] = useState(false);

  // Hash support (shareability, not compatibility: nothing links to the old
  // per-slug anchors). On mount and on hashchange, a hash matching a slug
  // selects that tab; clicking a tab replaces the hash without a history
  // entry. Runs only in effects, so SSR never touches window.
  useEffect(() => {
    const applyHash = (fromNavigation: boolean) => {
      const candidate = window.location.hash.slice(1);
      if (!PACKAGE_ROWS.some((p) => p.slug === candidate)) return;
      setSlug(candidate);
      if (fromNavigation) setUserSelected(true);
    };
    applyHash(false);
    const onHashChange = () => applyHash(true);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const select = (next: string) => {
    setSlug(next);
    setUserSelected(true);
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
                <InstallCommand pkg={`@web-ai-sdk/${p.title}`} />
                <a className={pkgDocs} href={guideLink(p.slug)}>
                  <span className={silverText}>
                    {PACKAGE_DOCS_LABELS[p.slug] ?? "Read the docs"}
                  </span>
                </a>
                {p.slug === "webmcp" && (
                  <p
                    className="mt-1 w-full text-[12px] leading-5 text-fg-4"
                    data-webmcp-agent-note
                  >
                    This demo detects <code>document.modelContext</code> and
                    routes tools in this page.
                    <br />
                    It cannot show whether an external agent will discover or
                    invoke a tool.
                  </p>
                )}
              </div>
            </div>
            <div className={pkgRight}>
              {active && Demo ? <Demo intent={userSelected} /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
