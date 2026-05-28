import { BrandMark } from "./components/BrandMark.js";
import { DetectorDemo } from "./components/DetectorDemo.js";
import { HowItWorks } from "./components/HowItWorks.js";
import { InstallPill } from "./components/InstallPill.js";
import { PromptDemo } from "./components/PromptDemo.js";
import { ScrollSpy } from "./components/ScrollSpy.js";
import { StarWidget } from "./components/StarWidget.js";
import { SummarizerDemo } from "./components/SummarizerDemo.js";
import { TranslatorDemo } from "./components/TranslatorDemo.js";
import { WebMCPDemo } from "./components/WebMCPDemo.js";
import {
  badge,
  badgeAccent,
  badgeKey,
  badgeRow,
  badgeVal,
  badgeValAccent,
  btnArrow,
  btnGhost,
  btnPrimary,
  card,
  caret,
  container,
  ctaBlock,
  ctaBlockText,
  ctaBlockTitle,
  ctaLink,
  ctaLinks,
  ctaRow,
  footer,
  footerBrandText,
  footerBrandTitle,
  footerColList,
  footerColTitle,
  footerGrid,
  footerMeta,
  hero,
  heroEyebrow,
  heroEyebrowDot,
  heroGrid,
  heroTitle,
  nav,
  navBrand,
  navCta,
  navInner,
  navLinks,
  permalink,
  philosophyCardBody,
  philosophyList,
  philosophyNum,
  philosophyText,
  philosophyTitle,
  pkgActions,
  pkgBullets,
  pkgDocs,
  pkgDocsArrow,
  pkgIcon,
  pkgInstall,
  pkgInstallPkg,
  pkgInstallPrompt,
  pkgLeft,
  pkgName,
  pkgRight,
  pkgRow,
  pkgTag,
  reveal,
  scope,
  section,
  sectionAnchor,
  sectionEyebrow,
  sectionHead,
  srOnly,
  stackBody,
  stackDetail,
  stackDetailMuted,
  stackDiagram,
  stackHeader,
  stackIdx,
  stackIdxAccent,
  stackIdxMuted,
  stackName,
  stackNameAccent,
  stackNameMuted,
  stackOwner,
  stackRowApi,
  stackRowBase,
  stackRowHook,
  subhead,
  subheadSub,
  supportHead,
  supportNote,
  supportPill,
  supportPillOk,
  supportPillWarn,
  supportRowHead,
  supportTable,
  supportVersion,
  supportWrap,
  twoCol,
} from "./lib/ui.js";
import { SDK_VERSION } from "./sdk-version.js";

const REPO = "obetomuniz/web-ai-sdk";

// Docs site (Astro Starlight) is deployed alongside the landing under
// `/docs/`. Using `import.meta.env.BASE_URL` keeps this correct under
// both the GH Pages base path (`/web-ai-sdk/`) and a future custom domain
// (`/`). In local dev this resolves to `/docs/` which won't be served by
// Vite; run `pnpm docs` separately on :6006 if you need it locally.
const DOCS_URL = `${import.meta.env.BASE_URL}docs/`;

// Deep-link to a per-package guide. Starlight serves clean URLs based on
// each MDX file's path under `src/content/docs/`, so we just append
// `guides/<slug>/` to the docs base.
const guideLink = (slug: string): string => `${DOCS_URL}guides/${slug}/`;

export const App = () => (
  <>
    {/* Page-background watermark. Single oversized mark anchored to the
        bottom-right corner, rendered in a tone-on-tone barely darker than
        --bg so it reads as ambient texture rather than a logo. Pure
        decoration; pointer-events off so it never blocks clicks. Hidden
        on mobile to keep small viewports clean. */}
    <BrandMark
      className="pointer-events-none fixed right-[-3vw] bottom-[-3vh] z-0 h-auto w-[clamp(360px,48vw,720px)] select-none text-[#080706] opacity-50 max-[760px]:hidden [--brand-mark-accent:currentColor]"
      title=""
    />

    {/* Top nav */}
    <nav className={nav}>
      <div className={`${container} ${navInner}`}>
        <a className={navBrand} href="#top">
          <span>web-ai-sdk</span>
          <span className={caret} />
        </a>
        <div className={navLinks}>
          <a href="#packages">Packages</a>
          <a href="#philosophy">Why composable</a>
          <a href="#how">How</a>
          <a href="#support">Support</a>
          <a href="#start">Get started</a>
        </div>
        <a
          className={navCta}
          href={`https://github.com/${REPO}`}
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </div>
    </nav>

    {/* Hero */}
    <header className={hero} id="top">
      <div className={`${container} ${heroGrid}`}>
        <div className={heroEyebrow}>
          <span className={heroEyebrowDot} />
          Built-in AI, the right way
        </div>
        <h1 className={heroTitle}>
          web-ai-sdk
          <span className={caret} />
        </h1>
        <p className={subhead}>
          <strong>Building blocks</strong> for the Web's built-in AI APIs.
          <span className={subheadSub}>
            Composable. No runtime deps. Just lifecycle, streaming, and
            AbortSignals.
            <br />
            Vanilla TypeScript by default, with optional React hooks.
          </span>
        </p>

        <div className={ctaRow}>
          <a className={`${btnPrimary} group`} href="#start">
            Get started <span className={btnArrow}>→</span>
          </a>
          <a
            className={btnGhost}
            href={`https://github.com/${REPO}`}
            target="_blank"
            rel="noreferrer"
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2 .37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            View on GitHub
          </a>
          <InstallPill pkg="@web-ai-sdk/all" />
        </div>

        <div className={badgeRow}>
          <span className={badgeAccent}>
            <span className={badgeKey}>runs</span>
            <span className={badgeValAccent}>100% on-device</span>
          </span>
          <span className={badge}>
            <span className={badgeKey}>types</span>
            <span className={badgeVal}>TypeScript native</span>
          </span>
          <span className={badge}>
            <span className={badgeKey}>stream</span>
            <span className={badgeVal}>AsyncIterable</span>
          </span>
          <span className={badge}>
            <span className={badgeKey}>license</span>
            <span className={badgeVal}>MIT</span>
          </span>
          <span className={badge}>
            <span className={badgeKey}>size</span>
            <span className={badgeVal}>8.6 kB · core</span>
          </span>
          <span className={badge}>
            <span className={badgeKey}>deps</span>
            <span className={badgeVal}>0</span>
          </span>
        </div>
      </div>
    </header>

    {/* Packages */}
    <section className={section} data-section="packages">
      <div className={container}>
        <div className={`${sectionHead} ${sectionAnchor}`} id="packages">
          <div>
            <div className={sectionEyebrow}>01 · packages</div>
            <h2 className="mt-2">Composable wrappers. One philosophy.</h2>
          </div>
          <a className={permalink} href="#packages">
            <span aria-hidden="true">§</span>
            <span className={srOnly}>Link to Packages section</span>
          </a>
        </div>

        {/* Prompt */}
        <div className={`${pkgRow} ${reveal}`} data-reveal id="prompt">
          <div className={pkgLeft}>
            <div className={pkgIcon} aria-hidden="true">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7h16M4 12h10M4 17h6" />
                <path d="M16 17l3 3 5-5" />
              </svg>
            </div>
            <div className={pkgName}>
              <span className={scope}>@web-ai-sdk/</span>prompt
            </div>
            <div className={pkgTag}>
              Talk to the on-device language model. Sessions, streaming, and
              AbortSignals; done.
            </div>
            <ul className={pkgBullets}>
              <li>
                <span>
                  <b>Session reuse.</b> Cached by config so re-renders don't
                  churn the model.
                </span>
              </li>
              <li>
                <span>
                  <b>Streaming first.</b> AsyncIterable out of the box; React
                  hook gives you a string.
                </span>
              </li>
              <li>
                <span>
                  <b>Clean lifecycle.</b> AbortController on unmount, retry on
                  session-lost.
                </span>
              </li>
            </ul>
            <div className={pkgActions}>
              <code className={pkgInstall}>
                <span className={pkgInstallPrompt}>$</span> npm install{" "}
                <span className={pkgInstallPkg}>@web-ai-sdk/prompt</span>
              </code>
              <a className={pkgDocs} href={guideLink("prompt")}>
                Read the docs <span className={pkgDocsArrow}>→</span>
              </a>
            </div>
          </div>
          <div className={pkgRight}>
            <PromptDemo />
          </div>
        </div>

        {/* WebMCP */}
        <div className={`${pkgRow} ${reveal}`} data-reveal id="webmcp">
          <div className={pkgLeft}>
            <div className={pkgIcon} aria-hidden="true">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="6" cy="6" r="2" />
                <circle cx="18" cy="6" r="2" />
                <circle cx="6" cy="18" r="2" />
                <circle cx="18" cy="18" r="2" />
                <path d="M8 6h8M6 8v8M18 8v8M8 18h8" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div className={pkgName}>
              <span className={scope}>@web-ai-sdk/</span>webmcp
            </div>
            <div className={pkgTag}>
              Register tools the browser's model context can call. Real agents,
              real cleanup, no boilerplate.
            </div>
            <ul className={pkgBullets}>
              <li>
                <span>
                  <b>Declarative tools.</b> Register from React; AbortSignal
                  cleanup on unmount.
                </span>
              </li>
              <li>
                <span>
                  <b>Last writer wins.</b> Re-registers on hot reload without
                  duplicate errors.
                </span>
              </li>
              <li>
                <span>
                  <b>Spec aligned.</b> Wraps <code>navigator.modelContext</code>{" "}
                  verbatim.
                </span>
              </li>
            </ul>
            <div className={pkgActions}>
              <code className={pkgInstall}>
                <span className={pkgInstallPrompt}>$</span> npm install{" "}
                <span className={pkgInstallPkg}>@web-ai-sdk/webmcp</span>
              </code>
              <a className={pkgDocs} href={guideLink("webmcp")}>
                Read the docs <span className={pkgDocsArrow}>→</span>
              </a>
            </div>
          </div>
          <div className={pkgRight}>
            <WebMCPDemo />
          </div>
        </div>

        {/* Summarizer */}
        <div className={`${pkgRow} ${reveal}`} data-reveal id="summarizer">
          <div className={pkgLeft}>
            <div className={pkgIcon} aria-hidden="true">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M7 9h10M7 13h10M7 17h6" />
              </svg>
            </div>
            <div className={pkgName}>
              <span className={scope}>@web-ai-sdk/</span>summarizer
            </div>
            <div className={pkgTag}>
              Key-points, TL;DR, headlines. Configurable type and length.
            </div>
            <ul className={pkgBullets}>
              <li>
                <span>
                  <b>Four shapes.</b> key-points · tl;dr · teaser · headline.
                </span>
              </li>
              <li>
                <span>
                  <b>Three lengths.</b> short, medium, long. Deterministic with
                  the same seed.
                </span>
              </li>
              <li>
                <span>
                  <b>Streaming summaries.</b> Pipe chunks straight into your UI.
                </span>
              </li>
            </ul>
            <div className={pkgActions}>
              <code className={pkgInstall}>
                <span className={pkgInstallPrompt}>$</span> npm install{" "}
                <span className={pkgInstallPkg}>@web-ai-sdk/summarizer</span>
              </code>
              <a className={pkgDocs} href={guideLink("summarizer")}>
                Read the docs <span className={pkgDocsArrow}>→</span>
              </a>
            </div>
          </div>
          <div className={pkgRight}>
            <SummarizerDemo />
          </div>
        </div>

        {/* Translator */}
        <div className={`${pkgRow} ${reveal}`} data-reveal id="translator">
          <div className={pkgLeft}>
            <div className={pkgIcon} aria-hidden="true">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 5h11M9 3v2M5 9c.5 4 4 7 8 7M13 5c-.5 4-4 7-8 7" />
                <path d="M13 21l4-10 4 10M14.5 17h5" />
              </svg>
            </div>
            <div className={pkgName}>
              <span className={scope}>@web-ai-sdk/</span>translator
            </div>
            <div className={pkgTag}>
              Pair-based translation with block-level round-trip. Walks the DOM,
              swaps text, keeps markup intact.
            </div>
            <ul className={pkgBullets}>
              <li>
                <span>
                  <b>Pair caching.</b> Sessions cached per source→target.
                  Switching is instant.
                </span>
              </li>
              <li>
                <span>
                  <b>Block round-trip.</b> Walks the DOM, swaps text, keeps the
                  markup intact.
                </span>
              </li>
              <li>
                <span>
                  <b>Falls back gracefully.</b> No-op fallback when the API is
                  missing.
                </span>
              </li>
            </ul>
            <div className={pkgActions}>
              <code className={pkgInstall}>
                <span className={pkgInstallPrompt}>$</span> npm install{" "}
                <span className={pkgInstallPkg}>@web-ai-sdk/translator</span>
              </code>
              <a className={pkgDocs} href={guideLink("translator")}>
                Read the docs <span className={pkgDocsArrow}>→</span>
              </a>
            </div>
          </div>
          <div className={pkgRight}>
            <TranslatorDemo />
          </div>
        </div>

        {/* Detector */}
        <div className={`${pkgRow} ${reveal}`} data-reveal id="detector">
          <div className={pkgLeft}>
            <div className={pkgIcon} aria-hidden="true">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M16 16l5 5" />
                <path d="M8 11h6M11 8v6" />
              </svg>
            </div>
            <div className={pkgName}>
              <span className={scope}>@web-ai-sdk/</span>detector
            </div>
            <div className={pkgTag}>
              Detect the language of any text on-device. Returns BCP-47 codes
              with confidence scores and a sorted list of alternates.
            </div>
            <ul className={pkgBullets}>
              <li>
                <span>
                  <b>Top candidate or full list.</b> Use the single best guess,
                  or inspect every alternate above your threshold.
                </span>
              </li>
              <li>
                <span>
                  <b>Bias hints.</b> Pass <code>expectedInputLanguages</code> to
                  break ties between similar languages.
                </span>
              </li>
              <li>
                <span>
                  <b>Wire the others.</b> Detect first, then call summarize /
                  translate / prompt with the result — you skip the manual{" "}
                  <code>language: "en"</code> argument.
                </span>
              </li>
            </ul>
            <div className={pkgActions}>
              <code className={pkgInstall}>
                <span className={pkgInstallPrompt}>$</span> npm install{" "}
                <span className={pkgInstallPkg}>@web-ai-sdk/detector</span>
              </code>
              <a className={pkgDocs} href={guideLink("detector")}>
                Read the docs <span className={pkgDocsArrow}>→</span>
              </a>
            </div>
          </div>
          <div className={pkgRight}>
            <DetectorDemo />
          </div>
        </div>
      </div>
    </section>

    {/* Why composable */}
    <section className={section} data-section="philosophy">
      <div className={container}>
        <div className={`${sectionHead} ${sectionAnchor}`} id="philosophy">
          <div>
            <div className={sectionEyebrow}>02 · philosophy</div>
            <h2 className="mt-2">Why composable.</h2>
          </div>
          <a className={permalink} href="#philosophy">
            <span aria-hidden="true">§</span>
            <span className={srOnly}>Link to Philosophy section</span>
          </a>
        </div>

        <div className={`${twoCol} ${reveal}`} data-reveal>
          <div className={card}>
            <div className={philosophyCardBody}>
              <h3 className={philosophyTitle}>
                <span className={philosophyNum}>01</span> We handle the gnarly
                bits.
              </h3>
              <p className={philosophyText}>
                The built-in AI surface is young. Capability checks, model
                downloads, abortable streams, session lifetimes, and DOM-rebuild
                safety are all things you'd otherwise re-implement in every
                component. We've already done it.
              </p>
              <ul className={philosophyList}>
                <li>Feature detection per package</li>
                <li>Session cache keyed by config</li>
                <li>AsyncIterable streams + AbortSignal cleanup</li>
                <li>Hot-reload &amp; StrictMode safe</li>
                <li>Zero-runtime fallback when API missing</li>
              </ul>
            </div>
          </div>
          <div className={card}>
            <div className={philosophyCardBody}>
              <h3 className={philosophyTitle}>
                <span className={philosophyNum}>02</span> You compose the stack.
              </h3>
              <p className={philosophyText}>
                We ship the lifecycle layer: state machines, streams, abort
                signals. Framework adapters, polyfills, UI primitives stay
                optional subpaths so they don't constrain your design system,
                framework, or styling stack. The same packages run in Next,
                Astro, Solid, Svelte, vanilla; anywhere TS runs.
              </p>
              <ul className={philosophyList}>
                <li>Framework-agnostic core (~2 kB)</li>
                <li>
                  Optional <code>/react</code> subpath (Vue, Svelte to follow)
                </li>
                <li>No global state, no providers required</li>
                <li>Tree-shakable per package</li>
                <li>Pick the layers you need; skip the rest</li>
              </ul>
            </div>
          </div>
        </div>

        <div className={`${stackDiagram} ${reveal}`} data-reveal>
          <div className={stackHeader}>
            <span>Architecture</span>
            <span>Owner</span>
          </div>

          <div className={`${stackRowBase} ${stackRowApi}`}>
            <span className={stackIdx}>00</span>
            <div className={stackBody}>
              <div className={`${stackName} ${stackNameMuted}`}>
                Browser built-in AI
              </div>
              <div className={`${stackDetail} ${stackDetailMuted}`}>
                navigator.modelContext &nbsp; Summarizer &nbsp; Translator
                &nbsp; LanguageModel &nbsp; LanguageDetector
              </div>
            </div>
            <span className={stackOwner}>platform</span>
          </div>

          <div className={stackRowBase}>
            <span className={`${stackIdx} ${stackIdxAccent}`}>01</span>
            <div className={stackBody}>
              <div className={stackName}>
                <span className={scope}>@web-ai-sdk/</span>X
              </div>
              <div className={stackDetail}>
                ask() &nbsp; createSession() &nbsp; summarize() &nbsp;
                translate() &nbsp; detect() &nbsp; registerTool() &nbsp;
                defineTool() &nbsp; AbortSignal &nbsp; session cache
              </div>
            </div>
            <span className={`${stackOwner} ${stackIdxAccent}`}>
              web-ai-sdk
            </span>
          </div>

          <div className={`${stackRowBase} ${stackRowHook}`}>
            <span className={`${stackIdx} ${stackIdxAccent}`}>02</span>
            <div className={stackBody}>
              <div className={`${stackName} ${stackNameAccent}`}>
                <span className={scope}>@web-ai-sdk/</span>X
                <span className={scope}>/react</span>
              </div>
              <div className={stackDetail}>
                usePrompt() &nbsp; useSession() &nbsp; useSummarizer() &nbsp;
                useTranslator() &nbsp; useDetector() &nbsp; useWebMCP()
              </div>
            </div>
            <span className={`${stackOwner} ${stackIdxAccent}`}>
              web-ai-sdk
            </span>
          </div>

          <div className={stackRowBase}>
            <span className={`${stackIdx} ${stackIdxMuted}`}>03</span>
            <div className={stackBody}>
              <div className={stackName}>Your application</div>
              <div className={stackDetail}>
                &lt;Card/&gt; &nbsp; &lt;Button/&gt; &nbsp; &lt;Spinner/&gt;
                &nbsp; your design system
              </div>
            </div>
            <span className={`${stackOwner} ${stackIdxMuted}`}>your code</span>
          </div>
        </div>
      </div>
    </section>

    {/* How it works */}
    <section className={section} data-section="how">
      <div className={container}>
        <div className={`${sectionHead} ${sectionAnchor}`} id="how">
          <div>
            <div className={sectionEyebrow}>03 · how it works</div>
            <h2 className="mt-2">Same task. Three levels of abstraction.</h2>
            <p className="mt-3.5 max-w-[60ch]">
              All three tabs do the same thing: detect an article's language and
              summarize it into key-points. Fifteen lines with the SDK;
              thirty-seven calling the browser APIs yourself. Same result, less
              to wire up.
            </p>
          </div>
          <a className={permalink} href="#how">
            <span aria-hidden="true">§</span>
            <span className={srOnly}>Link to How it works section</span>
          </a>
        </div>
        <div className={reveal} data-reveal>
          <HowItWorks />
        </div>
      </div>
    </section>

    {/* Browser support */}
    <section className={section} data-section="support">
      <div className={container}>
        <div className={`${sectionHead} ${sectionAnchor}`} id="support">
          <div>
            <div className={sectionEyebrow}>04 · support</div>
            <h2 className="mt-2">Browser support.</h2>
            <p className="mt-3.5 max-w-[60ch]">
              Built-in AI lands engine by engine. Where it isn't there yet, you
              get a feature-detected no-op so your code doesn't crash; render
              whatever fallback UI you want.
            </p>
          </div>
          <a className={permalink} href="#support">
            <span aria-hidden="true">§</span>
            <span className={srOnly}>Link to Browser support section</span>
          </a>
        </div>

        <div className={reveal} data-reveal>
          <div className={supportWrap}>
            <table className={supportTable}>
              <thead>
                <tr>
                  <th className={supportHead}>Package</th>
                  <th className={supportHead}>Chrome</th>
                  <th className={supportHead}>Edge</th>
                  <th className={supportHead}>Safari</th>
                  <th className={supportHead}>Firefox</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className={supportRowHead}>
                    <span className={scope}>@web-ai-sdk/</span>prompt
                  </th>
                  <td>
                    <span className={supportVersion}>148+</span>{" "}
                    <span className={`${supportPill} ${supportPillOk}`}>
                      stable
                    </span>
                  </td>
                  <td>
                    <span className={supportVersion}>138+</span>{" "}
                    <span className={supportPill}>Canary/Dev</span>
                  </td>
                  <td>
                    <span className={`${supportPill} ${supportPillWarn}`}>
                      no-op fallback
                    </span>
                  </td>
                  <td>
                    <span className={`${supportPill} ${supportPillWarn}`}>
                      no-op fallback
                    </span>
                  </td>
                </tr>
                <tr>
                  <th className={supportRowHead}>
                    <span className={scope}>@web-ai-sdk/</span>summarizer
                  </th>
                  <td>
                    <span className={supportVersion}>138+</span>{" "}
                    <span className={`${supportPill} ${supportPillOk}`}>
                      stable
                    </span>
                  </td>
                  <td>
                    <span className={supportVersion}>138+</span>{" "}
                    <span className={`${supportPill} ${supportPillOk}`}>
                      stable
                    </span>
                  </td>
                  <td>
                    <span className={`${supportPill} ${supportPillWarn}`}>
                      no-op fallback
                    </span>
                  </td>
                  <td>
                    <span className={`${supportPill} ${supportPillWarn}`}>
                      no-op fallback
                    </span>
                  </td>
                </tr>
                <tr>
                  <th className={supportRowHead}>
                    <span className={scope}>@web-ai-sdk/</span>translator
                  </th>
                  <td>
                    <span className={supportVersion}>138+</span>{" "}
                    <span className={`${supportPill} ${supportPillOk}`}>
                      stable
                    </span>
                  </td>
                  <td>
                    <span className={supportVersion}>143+</span>{" "}
                    <span className={supportPill}>Canary/Dev</span>
                  </td>
                  <td>
                    <span className={`${supportPill} ${supportPillWarn}`}>
                      no-op fallback
                    </span>
                  </td>
                  <td>
                    <span className={`${supportPill} ${supportPillWarn}`}>
                      no-op fallback
                    </span>
                  </td>
                </tr>
                <tr>
                  <th className={supportRowHead}>
                    <span className={scope}>@web-ai-sdk/</span>detector
                  </th>
                  <td>
                    <span className={supportVersion}>138+</span>{" "}
                    <span className={`${supportPill} ${supportPillOk}`}>
                      stable
                    </span>
                  </td>
                  <td>
                    <span className={supportVersion}>147+</span>{" "}
                    <span className={supportPill}>Canary/Dev</span>
                  </td>
                  <td>
                    <span className={`${supportPill} ${supportPillWarn}`}>
                      no-op fallback
                    </span>
                  </td>
                  <td>
                    <span className={`${supportPill} ${supportPillWarn}`}>
                      no-op fallback
                    </span>
                  </td>
                </tr>
                <tr>
                  <th className={supportRowHead}>
                    <span className={scope}>@web-ai-sdk/</span>webmcp
                  </th>
                  <td>
                    <span className={supportVersion}>146+</span>{" "}
                    <span className={supportPill}>flag</span>{" "}
                    <span className={supportPill}>OT 149+</span>
                  </td>
                  <td>
                    <span className={supportVersion}>147+</span>{" "}
                    <span className={supportPill}>flag</span>
                  </td>
                  <td>
                    <span className={`${supportPill} ${supportPillWarn}`}>
                      no-op fallback
                    </span>
                  </td>
                  <td>
                    <span className={`${supportPill} ${supportPillWarn}`}>
                      no-op fallback
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className={supportNote}>
            Versions reflect when the underlying platform API became available.
            Wrapper exports stay stable across all browsers. <strong>OT</strong>{" "}
            = origin trial.
            <br />
            On Edge, only the Summarizer ships in stable (enabled by default
            since Edge 138). Prompt is a developer preview in Edge Canary/Dev
            138+; Translator (Edge 143+) and Language Detector (Edge 147+) are
            Canary/Dev-only as well, each behind its own{" "}
            <code>edge://flags/</code> toggle. WebMCP landed in Edge 147 behind
            a flag.
            <br />
            <strong>macOS quirk:</strong> on macOS, the on-device model
            frequently refuses output for Prompt and Summarizer — Phi-4-mini's
            stricter safety pipeline returns "low quality output blocked" or C0
            control-character placeholders. The library handles both. Windows
            doesn't reproduce this; the four Built-in AI APIs work reliably
            there once flagged. Flags on <code>edge://flags/</code>: "Phi mini"
            (Prompt, Writing Assistance), "translation api" (Translator),
            "language detection" (Language Detector). Hardware check:{" "}
            <code>edge://on-device-internals</code> must show a "High" device
            performance class. WebMCP on Edge isn't yet covered by an official
            Microsoft developer-docs page; the version above reflects empirical
            Canary/Dev testing.
          </div>
        </div>
      </div>
    </section>

    {/* Get started */}
    <section className={section} data-section="start">
      <div className={container}>
        <div
          className={`${ctaBlock} ${sectionAnchor} ${reveal}`}
          data-reveal
          id="start"
        >
          <div className={`${sectionEyebrow} mb-5 justify-center`}>
            05 · ship it
          </div>
          <h2 className={ctaBlockTitle}>Try it in your project.</h2>
          <p className={ctaBlockText}>
            One install, all five blocks. Or pick the individual{" "}
            <code>@web-ai-sdk/*</code> packages. Ships ESM, CJS, and types.
            Tree-shakable.
          </p>
          <InstallPill pkg="@web-ai-sdk/all" className="mx-auto" />
          <div className={ctaLinks}>
            <a className={ctaLink} href={DOCS_URL}>
              Read the docs <span>↗</span>
            </a>
            <a
              className={ctaLink}
              href={`https://github.com/${REPO}`}
              target="_blank"
              rel="noreferrer"
            >
              GitHub repo <span>↗</span>
            </a>
            <StarWidget repo={REPO} />
          </div>
        </div>
      </div>
    </section>

    {/* Footer */}
    <footer className={footer}>
      <div className={container}>
        <div className={footerGrid}>
          <div>
            <div className={footerBrandTitle}>
              <span>web-ai-sdk</span>
              <span className={caret} />
            </div>
            <p className={footerBrandText}>
              Building blocks for the Web's built-in AI APIs.
            </p>
          </div>
          <div>
            <h4 className={footerColTitle}>Project</h4>
            <ul className={footerColList}>
              <li>
                <a href={DOCS_URL}>Docs</a>
              </li>
              <li>
                <a
                  href={`https://github.com/${REPO}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://www.npmjs.com/org/web-ai-sdk"
                  target="_blank"
                  rel="noreferrer"
                >
                  npm
                </a>
              </li>
              <li>
                <a
                  href={`https://github.com/${REPO}/blob/main/.changeset/initial-release.md`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Changelog
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className={footerColTitle}>Community</h4>
            <ul className={footerColList}>
              <li>
                <a
                  href={`https://github.com/${REPO}/issues`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Issues
                </a>
              </li>
              <li>
                <a
                  href={`https://github.com/${REPO}/discussions`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Discussions
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className={footerColTitle}>About</h4>
            <ul className={footerColList}>
              <li>
                Built by{" "}
                <a
                  href="https://betomuniz.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  @obetomuniz
                </a>
              </li>
              <li>
                <a
                  href={`https://github.com/${REPO}/blob/main/LICENSE`}
                  target="_blank"
                  rel="noreferrer"
                >
                  MIT licensed
                </a>
              </li>
              <li>100% on-device</li>
            </ul>
          </div>
        </div>
        <div className={footerMeta}>
          <span>web-ai-sdk v{SDK_VERSION}</span>
          <span>
            <a href="#top">Back to top ↑</a>
          </span>
        </div>
      </div>
    </footer>

    <ScrollSpy />
  </>
);
