/** Composed Tailwind classes shared across site demos and sections. */

export const card =
  "relative min-w-0 overflow-hidden rounded-lg bg-surface shadow-card transition-colors hover:bg-surface-2";

export const cardHead =
  "flex items-center justify-between border-b border-hairline px-4 py-3 font-mono text-xs text-fg-3";

export const cardHeadTitle = "inline-flex items-center gap-2.5";

export const cardBody = "flex flex-col gap-4 p-5 max-[480px]:p-4";

export const cardDot = "size-[7px] rounded-full bg-fg-4";

export const cardDotLive =
  "size-[7px] rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-soft)]";

export const cardDotOk = "size-[7px] rounded-full bg-ok";

export const btnSm =
  "inline-flex cursor-pointer items-center gap-2 rounded-sm border border-accent bg-accent px-3.5 py-2 font-mono text-[12.5px] font-semibold text-brand-dark transition-all hover:border-accent-bright hover:bg-accent-bright active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 max-[640px]:w-full max-[640px]:justify-center max-[640px]:px-3.5 max-[640px]:py-2.5";

export const btnSmGhost =
  "inline-flex cursor-pointer items-center gap-2 rounded-sm border border-fg-4 bg-transparent px-3.5 py-2 font-mono text-[12.5px] font-semibold text-fg-2 transition-all hover:border-fg-3 hover:bg-transparent hover:text-fg active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 max-[640px]:w-full max-[640px]:justify-center max-[640px]:px-3.5 max-[640px]:py-2.5";

export const demoControls =
  "flex flex-wrap items-center gap-2 max-[640px]:gap-2.5";

export const chipRow = "flex flex-wrap items-center gap-1.5";

export const chipRowInline =
  "flex shrink-0 flex-nowrap items-center gap-1.5 max-[640px]:flex-wrap";

export const chipRowEnd = "ml-auto max-[640px]:ml-0 max-[640px]:w-full";

const chipBase =
  "cursor-pointer appearance-none rounded-pill border px-2.5 py-[5px] font-mono text-[11px] transition-all max-[640px]:px-2.5 max-[640px]:py-1.5 max-[640px]:text-[11.5px]";

export const chip = `${chipBase} border-hairline-2 bg-transparent text-fg-3 hover:border-fg-3 hover:text-fg`;

export const chipActive = `${chipBase} border-accent bg-accent-soft text-accent-bright`;

export const chipSep = "mx-1 inline-block h-3.5 w-px bg-hairline-2";

export const fieldSpaced = "grid min-w-0 gap-2";

export const fieldGroup = "grid w-full min-w-0 gap-2";

export const fieldset =
  "m-0 rounded-md border border-hairline bg-[color-mix(in_oklch,var(--color-surface-2)_50%,transparent)] px-3.5 pb-3 pt-3.5";

export const fieldLegend =
  "-ml-1 px-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-4";

export const label =
  "block font-mono text-[11px] uppercase leading-none tracking-[0.08em] text-fg-4";

export const input =
  "w-full rounded-sm border border-hairline bg-bg px-3 py-2.5 font-mono text-[13px] leading-[1.5] text-fg transition-[border-color,background] focus:border-accent-line focus:bg-surface-2 focus:outline-none";

export const textarea =
  "min-h-fit w-full resize-y rounded-sm border border-hairline bg-bg px-3 py-2.5 font-mono text-[13px] leading-[1.5] text-fg transition-[border-color,background] [field-sizing:content] focus:border-accent-line focus:bg-surface-2 focus:outline-none";

const selectChevron =
  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M1%201.5L6%206.5L11%201.5%22%20stroke%3D%22%238a8175%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_8px] bg-[position:right_12px_center] bg-no-repeat";

export const select = `h-[38px] w-full cursor-pointer appearance-none rounded-sm border border-hairline bg-bg px-3 pr-9 font-mono text-[13px] leading-[38px] text-fg transition-[border-color,background] focus:border-accent-line focus:bg-surface-2 focus:outline-none ${selectChevron}`;

/** Pill select — matches selected `chipActive` styling (current value always shown). */
export const chipSelect = `${chipActive} appearance-none pr-7 max-[640px]:pr-8 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`;

export const chipSelectWrap = "relative inline-flex shrink-0 items-center";

export const chipSelectCaret =
  "pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 font-mono text-[9px] leading-none text-accent-bright";

export const caret =
  "inline-block h-[0.08em] w-[0.5em] shrink-0 animate-blink rounded-[1px] bg-accent align-baseline ml-[0.06em]";

const tabsBase =
  "flex gap-1 border-b border-hairline max-[880px]:flex-nowrap max-[880px]:overflow-x-auto max-[880px]:[scrollbar-width:thin]";

export const tabs = `${tabsBase} px-2`;

// Flush variant for bare (non-card) tab strips: no container inset, so each
// tab's own px-4 (tabBase) sets the gap from the section edge instead of
// stacking on top of a container inset. The inset is omitted from the base
// rather than overridden with px-0, per the rule against conflicting utility
// merges.
export const tabsFlush = `${tabsBase}`;

const tabBase =
  "group/tab mb-[-1px] inline-flex shrink-0 cursor-pointer items-center gap-2 border-x-0 border-t-0 border-b border-solid border-transparent bg-transparent px-4 py-3 font-mono text-[12.5px] transition-colors focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent max-[880px]:px-3.5";

export const tab = `${tabBase} text-fg-3 hover:text-fg`;

export const tabActive = `${tabBase} border-b-accent text-accent`;

export const tabPackageIcon =
  "size-4 shrink-0 overflow-visible [&_*]:origin-center [&_*]:[transform-box:fill-box] motion-reduce:[&_*]:animate-none";

export const tabPackageIconMotion = {
  prompt: "group-hover/tab:[&_path]:animate-icon-draw",
  webmcp:
    "group-hover/tab:[&_rect]:animate-icon-register group-hover/tab:[&_rect:nth-child(2)]:[animation-delay:70ms] group-hover/tab:[&_rect:nth-child(3)]:[animation-delay:140ms] group-hover/tab:[&_rect:nth-child(4)]:[animation-delay:210ms]",
  summarizer:
    "group-hover/tab:[&_line]:origin-left group-hover/tab:[&_line:nth-child(1)]:animate-icon-compress-top group-hover/tab:[&_line:nth-child(2)]:animate-icon-compress-middle group-hover/tab:[&_line:nth-child(3)]:animate-icon-compress-bottom",
  translator:
    "group-hover/tab:[&_.translator-source]:animate-icon-swap-forward group-hover/tab:[&_.translator-target]:animate-icon-swap-back",
  detector:
    "group-hover/tab:[&_circle]:animate-icon-scan group-hover/tab:[&_path]:animate-icon-draw",
  writer:
    "group-hover/tab:[&_path:first-child]:animate-icon-draw group-hover/tab:[&_path:last-child]:animate-icon-write",
  rewriter:
    "group-hover/tab:[&_path:nth-child(1)]:animate-icon-draw group-hover/tab:[&_path:nth-child(2)]:animate-icon-send group-hover/tab:[&_path:nth-child(3)]:animate-icon-draw group-hover/tab:[&_path:nth-child(4)]:animate-icon-send group-hover/tab:[&_path:nth-child(4)]:[animation-delay:120ms]",
  proofreader:
    "group-hover/tab:[&_circle]:animate-icon-scan group-hover/tab:[&_path]:animate-icon-check",
} as const;

export const tabLines = "text-[11px] text-fg-4";

export const tabLinesActive = "text-accent-dim";

export const term =
  "relative bg-surface font-mono text-[13px] leading-[1.6] text-fg-2";

// overflow-y-hidden is required: with only overflow-x set, the spec promotes
// overflow-y to auto, which shows a phantom vertical scrollbar on mobile (where
// the horizontal scrollbar reserves height). py-5 keeps the last line clear.
export const termBody =
  "overflow-x-auto overflow-y-hidden px-[22px] py-5 [counter-reset:ln]";

export const termLine =
  "grid grid-cols-[28px_1fr] gap-3.5 before:text-right before:text-fg-4 before:tabular-nums before:content-[counter(ln)] before:[counter-increment:ln]";

export const termLineBlank = "before:invisible";

export const tokKw = "text-[oklch(0.74_0.13_290)]";
export const tokFn = "text-[oklch(0.78_0.13_80)]";
export const tokStr = "text-[oklch(0.74_0.13_150)]";
export const tokNum = "text-[oklch(0.74_0.13_220)]";
export const tokCom = "text-fg-4 italic";
export const tokTyp = "text-[oklch(0.74_0.10_200)]";
export const tokAcc = "text-accent-bright";

export const outputBox =
  "relative min-h-20 wrap-break-word rounded-sm border border-hairline bg-bg px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] text-fg whitespace-pre-wrap";

export const toolList = "m-0 grid list-none gap-1.5 p-0";

export const toolToggle =
  "grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-sm border border-hairline bg-bg px-3 py-2.5 text-left font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent hover:border-hairline-2 max-[640px]:gap-2.5 max-[640px]:p-2.5";

export const toolToggleTrack =
  "relative h-4 w-7 rounded-pill border border-hairline-2 bg-surface-3 transition-[background] after:absolute after:top-0.5 after:left-0.5 after:size-2.5 after:rounded-full after:bg-fg-3 after:transition-[transform,background] group-data-[on=true]/tool:after:translate-x-3 group-data-[on=true]/tool:after:bg-accent group-data-[on=true]/tool:border-accent-line group-data-[on=true]/tool:bg-accent-soft";

export const langPair =
  "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2.5 max-[640px]:flex max-[640px]:flex-col max-[640px]:gap-2";

/** Desktop: `contents` so the swap btn stays a grid item. Mobile: centers the swap row. */
export const langSwapWrap =
  "contents max-[640px]:flex max-[640px]:w-full max-[640px]:justify-center";

export const langSwapBtn =
  "inline-flex size-[38px] shrink-0 items-center justify-center self-end rounded-sm border border-hairline-2 bg-transparent font-mono text-base leading-none text-fg-2 transition-colors hover:border-fg-3 hover:text-fg max-[640px]:self-auto max-[640px]:rotate-90";

export const markdownProse =
  "font-sans text-[13.5px] leading-[1.65] whitespace-normal [&>div>:first-child]:mt-0 [&>div>:last-child]:mb-0 [&_p]:mb-2.5 [&_p]:text-fg [&_h1]:my-3.5 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:tracking-[-0.01em] [&_h1]:text-fg [&_h2]:my-3.5 [&_h2]:mb-2 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-fg [&_h3]:my-3.5 [&_h3]:mb-2 [&_h3]:text-[13.5px] [&_h3]:font-semibold [&_h3]:tracking-[-0.01em] [&_h3]:text-accent-bright [&_h4]:my-3.5 [&_h4]:mb-2 [&_h4]:text-[13px] [&_h4]:font-semibold [&_h4]:tracking-[-0.01em] [&_h4]:text-fg-2 [&_ul]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-[22px] [&_ol]:mb-2.5 [&_ol]:list-decimal [&_ol]:pl-[22px] [&_li]:my-0.5 [&_li>p]:m-0 [&_li]:marker:text-fg-4 [&_strong]:font-semibold [&_strong]:text-fg [&_em]:text-fg-2 [&_a]:text-accent-bright [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:border [&_code]:border-hairline [&_code]:bg-surface-2 [&_code]:px-[5px] [&_code]:py-px [&_code]:font-mono [&_code]:text-xs [&_code]:text-fg [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:border [&_pre]:border-hairline [&_pre]:bg-surface [&_pre]:p-3.5 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-normal [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-accent-line [&_blockquote]:py-1 [&_blockquote]:pl-3 [&_blockquote]:text-fg-2 [&_blockquote]:italic [&_hr]:my-3.5 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-hairline [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-hairline [&_th]:bg-surface-2 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_th]:text-fg [&_td]:border [&_td]:border-hairline [&_td]:px-2.5 [&_td]:py-1.5";

export const markdownProseEmpty = "font-mono text-[12.5px]";

export const reveal =
  "opacity-0 translate-y-4 transition-[opacity,transform] duration-[600ms] ease-[cubic-bezier(0.2,0.6,0.2,1)] data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0";

// ---------- Page layout ----------

export const container =
  "relative z-1 mx-auto min-w-0 max-w-[1180px] px-[var(--gutter)] max-[880px]:px-5";

// content-visibility skips rendering offscreen sections for smoother scroll FPS;
// `contain-intrinsic-size: auto <estimate>` remembers each section's real height
// after first render, so the scrollbar doesn't keep jumping.
export const section =
  "relative py-[var(--section-py)] [content-visibility:auto] [contain-intrinsic-size:auto_700px]";

export const sectionAnchor = "scroll-mt-[calc(var(--nav-height)+1.5rem)]";

export const sectionHead =
  "mb-8 grid grid-cols-[1fr_auto] items-baseline gap-6 max-[880px]:mb-6";

export const sectionEyebrow =
  "inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-4";

export const permalink =
  "inline-flex size-7 items-center justify-center rounded-sm border border-hairline font-mono text-[13px] leading-none text-fg-4 no-underline transition-[color,border-color] hover:border-[color-mix(in_oklch,var(--color-accent)_40%,var(--color-hairline))] hover:text-accent max-[880px]:size-auto max-[880px]:rounded-none max-[880px]:border-0 max-[880px]:p-1.5 max-[880px]:hover:border-transparent [&>span[aria-hidden=true]]:translate-y-[-0.9px] [&>span[aria-hidden=true]]:opacity-75";

export const srOnly =
  "absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0,0,0,0)]";

export const nav =
  "sticky top-0 z-50 border-b border-hairline bg-[color-mix(in_oklch,var(--color-bg)_78%,transparent)] backdrop-blur-[14px] backdrop-saturate-[1.2]";

export const navInner =
  "grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 max-[640px]:grid-cols-[1fr_auto]";

export const navBrand =
  "flex items-baseline gap-[0.1em] font-mono text-sm tracking-[-0.01em]";

export const navMinimap =
  "relative flex h-10 w-48 items-center justify-center justify-self-center [&_a.active>span:first-child]:!h-8 [&_a.active>span:first-child]:!w-[3px] [&_a.active>span:first-child]:!bg-accent [&_a.active>span:first-child]:!opacity-100 max-[640px]:hidden";

export const navMinimapLink =
  "group/map relative flex h-10 w-6 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent";

export const navMinimapTick =
  "block w-0.5 rounded-pill bg-fg-4 opacity-55 transition-[width,height,background-color,opacity] duration-200 group-hover/map:h-6 group-hover/map:w-[3px] group-hover/map:bg-fg-2 group-hover/map:opacity-100 group-focus-visible/map:h-6 group-focus-visible/map:w-[3px] group-focus-visible/map:bg-fg-2 group-focus-visible/map:opacity-100";

export const navMinimapPreview =
  "pointer-events-none absolute top-[calc(100%+8px)] left-1/2 z-60 grid w-[300px] -translate-x-1/2 -translate-y-1 gap-1 rounded-md border border-hairline-2 bg-[color-mix(in_oklch,var(--color-surface-2)_94%,transparent)] px-4 py-3 text-left shadow-card opacity-0 backdrop-blur-[16px] transition-[opacity,transform] duration-150 group-hover/map:translate-y-0 group-hover/map:opacity-100 group-focus-visible/map:translate-y-0 group-focus-visible/map:opacity-100 max-[640px]:fixed max-[640px]:top-[calc(var(--nav-height)+10px)] max-[640px]:w-[calc(100vw-40px)] max-[640px]:translate-y-0";

export const navMinimapTitle =
  "font-sans text-[14px] font-medium leading-snug text-fg";

export const navMinimapSummary =
  "font-sans text-[12.5px] leading-snug text-fg-3";

export const navCta =
  "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-sm border border-hairline-2 px-3 py-2 font-mono text-[12.5px] text-fg-2 transition-all hover:border-accent-line hover:text-fg max-[640px]:size-9 max-[640px]:p-0";

// Right-aligned nav action group: the icon-only Docs link plus the GitHub CTA.
export const navActions = "flex items-center justify-self-end gap-2";

// Borderless, icon-only nav button. Sits next to the GitHub CTA; a micro
// scale + color lift on hover gives it a tactile affordance without a box.
export const navIcon =
  "inline-flex items-center justify-center rounded-sm p-2 text-fg-3 transition-all duration-200 ease-out hover:scale-110 hover:text-fg";

export const hero =
  "flex min-h-[100svh] flex-col justify-center py-[calc(96px*var(--density))] max-[880px]:min-h-[clamp(420px,64svh,540px)] max-[880px]:py-12 max-[640px]:py-10";

export const heroGrid =
  "grid gap-8 max-[880px]:gap-6 max-[640px]:justify-items-center max-[640px]:gap-7 max-[640px]:text-center";

// Bare mono kicker (no pill box): a plain uppercase label with the accent dot,
// used above the hero headline in place of the old slogan-in-a-pill eyebrow.
export const heroKicker =
  "inline-flex w-fit items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-4";

export const heroKickerDesktopLabel = "max-[640px]:hidden";

export const heroKickerMobileLabel = "hidden max-[640px]:inline";

export const heroEyebrowDot =
  "size-1.5 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-soft)]";

// Highlight: theme-aware gradient fill + neon glow for emphasized inline text.
// Apply to any element; reads as a metallic sheen in Noir, colored neon in
// tinted themes. Tokens live in index.css (--gradient-text / --glow-text).
export const gradientText =
  "bg-[image:var(--gradient-text)] bg-clip-text text-transparent [filter:var(--glow-text)]";

export const heroTitle =
  "flex flex-nowrap items-baseline gap-[0.1em] font-display text-[clamp(54px,9vw,112px)] leading-[0.95] font-medium tracking-[-0.04em] max-[640px]:text-[56px] max-[480px]:text-[44px]";

export const heroTextBackdrop =
  "[text-shadow:0_1px_2px_var(--color-bg),0_0_18px_var(--color-bg),0_0_42px_var(--color-bg)]";

export const subhead =
  "max-w-[820px] text-[clamp(17px,1.6vw,20px)] leading-[1.5] tracking-[-0.01em] text-fg-2 [&_strong]:font-medium [&_strong]:text-fg";

export const ctaRow =
  "mt-2 flex flex-wrap items-center gap-6 max-[640px]:w-full max-[640px]:flex-col max-[640px]:justify-center max-[640px]:gap-4";

const btnBase =
  "inline-flex cursor-pointer items-center gap-2.5 rounded-pill border px-5 py-3 font-mono text-[13px] tracking-[-0.005em] no-underline transition-all active:translate-y-px max-[640px]:px-4 max-[640px]:py-2.5 max-[640px]:text-[13px]";

export const btn = `${btnBase} border-transparent`;

export const btnPrimary = `${btnBase} border-accent bg-accent font-semibold text-brand-dark hover:border-accent-bright hover:bg-accent-bright hover:text-brand-dark`;

// Package explorer panel: two-column grid without stacked-row sibling margins.
// Panels are siblings where all but one carry the `hidden` attribute, and
// `.x + .x` matches hidden siblings too, so a sibling margin would shift the
// visible panel whenever a non-first tab is active.
export const pkgPanel =
  "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-16 pt-10 max-[880px]:grid-cols-1 max-[880px]:gap-8 max-[880px]:pt-8";

export const pkgLeft = "min-w-0 pt-2";

export const pkgRight = "min-w-0";

export const pkgName =
  "mb-2.5 font-mono text-[22px] tracking-[-0.02em] text-fg";

export const scope = "text-fg-4";

export const pkgTag =
  "mb-6 max-w-[30ch] text-[17px] tracking-[-0.01em] text-fg-2";

export const pkgBullets =
  "mb-6 grid list-none gap-[9px] p-0 [&_li]:flex [&_li]:items-start [&_li]:gap-3 [&_li]:text-sm [&_li]:text-fg-2 [&_li]:before:mt-[7px] [&_li]:before:size-1 [&_li]:before:shrink-0 [&_li]:before:rounded-full [&_li]:before:bg-accent [&_li]:before:content-[''] [&_b]:font-medium [&_b]:text-fg";

export const pkgActions = "flex w-fit max-w-full flex-col items-start gap-4";

export const pkgInstall =
  "w-fit max-w-full whitespace-nowrap rounded-sm border border-hairline bg-surface px-3.5 py-2.5 font-mono text-[12.5px] text-fg-2";

export const pkgInstallPrompt = "mr-2 text-fg-4";

export const pkgInstallPkg = "text-accent";

export const pkgDocs =
  "inline-flex items-center font-mono text-[12.5px] text-fg-3 hover:text-accent";

export const heroRepoLink =
  "inline-flex items-center gap-2 font-mono text-[15px] font-semibold text-fg no-underline transition-colors hover:text-accent-bright";

// Silver shimmer for link labels: clips the metallic --gradient-silver ramp to
// the text and loops a traveling highlight (see home.css keyframes). Disabled
// under prefers-reduced-motion, where it settles to the resting silver tone.
export const silverText =
  "bg-[image:var(--gradient-silver)] bg-[length:200%_100%] bg-clip-text text-transparent animate-silver motion-reduce:animate-none";

export const githubMark = "size-5 shrink-0 fill-current";

export const twoCol = "grid grid-cols-2 gap-8 max-[880px]:grid-cols-1";

export const whyRawGrid =
  "grid max-w-[1100px] grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-x-14 gap-y-6 max-[880px]:grid-cols-1";

export const whyRawLead =
  "max-w-[520px] text-[25px] leading-[1.35] tracking-[-0.03em] text-fg max-[640px]:text-[20px]";

export const whyRawText =
  "max-w-[580px] text-[16.5px] leading-[1.8] text-fg-2 max-[640px]:text-[15.5px]";

export const philosophyTitle =
  "mb-3 font-sans text-[25px] leading-[1.3] tracking-[-0.03em] text-fg max-[640px]:text-[20px]";

export const philosophyNum = "mr-2.5 font-mono text-sm text-accent";

export const philosophyText =
  "text-[16.5px] leading-[1.8] text-fg-2 max-[640px]:text-[15.5px]";

export const philosophyList =
  "mt-5 grid list-none gap-2 p-0 [&_li]:relative [&_li]:pl-[20px] [&_li]:font-mono [&_li]:text-[13.5px] [&_li]:text-fg-3 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-accent [&_li]:before:content-['✓']";

export const stackDiagram =
  "relative mt-10 overflow-hidden rounded-lg bg-surface shadow-card";

export const stackHeader =
  "grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-5 bg-surface-2 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-4 [&>span:first-child]:col-start-2 max-[640px]:grid-cols-[36px_minmax(0,1fr)] max-[640px]:gap-4 max-[640px]:px-4 max-[640px]:[&>span:last-child]:hidden";

export const stackRowBase =
  "relative grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-5 px-6 py-6 transition-colors hover:bg-surface-2 before:pointer-events-none before:absolute before:bottom-0 before:left-[44px] before:top-0 before:w-px before:bg-hairline-2 before:content-[''] max-[640px]:grid-cols-[36px_minmax(0,1fr)] max-[640px]:gap-x-4 max-[640px]:px-4 max-[640px]:py-4 max-[640px]:before:left-[34px]";

export const stackRowStart = "before:!top-1/2";

export const stackRowHook =
  "bg-[color-mix(in_oklch,var(--color-accent)_5%,transparent)] hover:bg-[color-mix(in_oklch,var(--color-accent)_8%,transparent)]";

export const stackRowEnd = "before:!bottom-1/2";

export const stackIcon =
  "relative z-1 grid size-9 place-items-center justify-self-center rounded-sm border border-hairline-2 bg-bg text-fg-3 [&_svg]:size-4";

export const stackAccent =
  "border-accent-line bg-accent-soft text-accent-bright";

export const stackMuted = "text-fg-2";

export const stackBody = "min-w-0";

export const stackName =
  "mb-1.5 font-mono text-base tracking-[-0.01em] text-fg";

export const stackNameAccent = "text-accent-bright";

export const stackNameMuted = "text-fg-2";

export const stackDetail =
  "break-words font-mono text-xs leading-[1.6] text-fg-3";

export const stackDetailMuted = "text-fg-4";

export const stackOwner =
  "whitespace-nowrap rounded-sm border border-hairline-2 bg-bg px-2.5 py-[5px] font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4 max-[640px]:col-start-2 max-[640px]:mt-[-2px] max-[640px]:w-fit";

export const supportWrap =
  "overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]";

export const supportTable =
  "min-w-[560px] w-full border-separate border-spacing-0 font-mono text-[13px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap [&_td]:px-5 [&_td]:py-3.5 [&_td]:text-center [&_td]:align-middle [&_td]:text-fg-2 [&_thead_th]:px-5 [&_thead_th]:pt-1 [&_thead_th]:pb-3 [&_thead_th]:text-left [&_tbody_td]:bg-surface [&_tbody_td]:transition-colors [&_tbody_th]:text-left [&_tbody_th]:transition-colors [&_tbody_tr:nth-child(even)_td]:bg-surface-2 [&_tbody_tr:nth-child(even)_th]:bg-surface-2 [&_tbody_tr:first-child_th]:rounded-tl-md [&_tbody_tr:first-child_td:last-child]:rounded-tr-md [&_tbody_tr:last-child_th]:rounded-bl-md [&_tbody_tr:last-child_td:last-child]:rounded-br-md [&_tbody_tr:hover_td]:!bg-surface-3 [&_tbody_tr:hover_th]:!bg-surface-3";

export const supportHead =
  "text-[11px] font-medium uppercase tracking-[0.1em] text-fg-4";

export const supportCenteredHead = "!text-center";

export const browserLabel =
  "inline-flex items-center justify-center gap-2.5 text-fg-3";

export const browserIcon = "size-[18px] shrink-0 object-contain";

export const supportRowHead =
  "bg-surface px-5 py-3.5 text-[12.5px] font-normal text-fg";

export const supportVersion =
  "inline-block rounded-sm bg-surface-3 px-2 py-[3px] text-[11px] tracking-[0.04em]";

export const supportVersionOk =
  "bg-[color-mix(in_oklch,var(--color-ok)_15%,var(--color-surface-3))] text-ok";

export const supportVersionPreview =
  "bg-[color-mix(in_oklch,var(--color-warn)_18%,var(--color-surface-3))] text-warn";

export const supportVersionFlag =
  "bg-[color-mix(in_oklch,var(--color-fg-4)_18%,var(--color-surface-3))] text-fg-3";

export const supportVersionLink =
  "no-underline transition-colors hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const supportPill =
  "inline-block rounded-sm bg-surface-3 px-2 py-[3px] text-[11px] tracking-[0.04em] text-fg-3";

export const supportPillOk =
  "bg-[color-mix(in_oklch,var(--color-ok)_15%,var(--color-surface-3))] text-ok";

export const supportPillWarn =
  "bg-[color-mix(in_oklch,var(--color-warn)_18%,var(--color-surface-3))] text-warn";

export const supportNote =
  "mt-3 font-mono text-[10.5px] leading-[1.5] tracking-[0.02em] text-fg-4";

// Capability matrix: same table skeleton as the browser support grid
// (supportWrap / supportTable / supportHead / supportRowHead), one row per
// API, one column per lifecycle feature the SDK layer provides.
export const matrixCell = "text-center";

export const matrixMark =
  "inline-flex size-5 items-center justify-center rounded-full text-[11px]";

export const matrixMarkOn =
  "bg-[color-mix(in_oklch,var(--color-ok)_15%,var(--color-surface-3))] text-ok";

export const matrixMarkOff = "text-fg-4";

export const ctaBlock =
  "relative z-1 rounded-lg bg-surface shadow-card bg-[radial-gradient(600px_200px_at_50%_0%,var(--color-accent-soft),transparent_70%)] px-14 py-14 text-center max-[880px]:px-6 max-[880px]:py-9";

export const ctaSection =
  "relative z-0 overflow-visible py-[var(--section-py)] pb-[calc(var(--section-py)*2)]";

export const ctaGlow =
  "relative z-0 isolate before:pointer-events-none before:absolute before:-inset-x-5 before:-top-5 before:bottom-0 before:-z-1 before:animate-rainbow-glow before:rounded-[24px] before:bg-[linear-gradient(100deg,#d946ef_0%,#8b5cf6_24%,#3b82f6_48%,#06b6d4_70%,#22c55e_100%)] before:bg-[length:180%_100%] before:opacity-55 before:blur-[52px] before:will-change-[background-position] before:content-[''] max-[640px]:before:-inset-x-2 max-[640px]:before:-top-2 max-[640px]:before:opacity-45 max-[640px]:before:blur-[34px]";

export const ctaBlockTitle = "mb-3";

export const ctaBlockText = "mx-auto mb-8 max-w-[560px] text-fg-2";

export const ctaLinks = "mt-6 flex flex-wrap justify-center gap-4";

export const ctaLink =
  "inline-flex items-center gap-2 rounded-sm border border-hairline-2 px-3 py-2 font-mono text-[12.5px] text-fg-3 hover:border-accent-line hover:text-fg";

export const footer = "border-t border-hairline py-[72px] pb-14";

export const footerGrid =
  "grid grid-cols-[1.4fr_1fr_1fr_1fr] items-start gap-10 max-[880px]:grid-cols-2 max-[480px]:grid-cols-1";

export const footerBrandTitle =
  "mb-3.5 flex items-baseline gap-[0.1em] font-mono text-base tracking-[-0.01em]";

export const footerBrandText = "max-w-[28ch] text-[13px] text-fg-3";

export const footerColTitle =
  "mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-4";

export const footerColList =
  "grid list-none gap-2.5 p-0 [&_a]:relative [&_a]:inline-block [&_a]:font-mono [&_a]:text-[13px] [&_a]:text-fg-2 [&_a]:transition-colors [&_a:hover]:text-accent [&_a]:after:pointer-events-none [&_a]:after:absolute [&_a]:after:-bottom-0.5 [&_a]:after:left-0 [&_a]:after:h-px [&_a]:after:w-full [&_a]:after:origin-left [&_a]:after:scale-x-0 [&_a]:after:bg-accent [&_a]:after:transition-transform [&_a]:after:duration-200 [&_a]:after:content-[''] [&_a:hover]:after:scale-x-100";

export const footerMeta =
  "mt-14 flex flex-wrap justify-between gap-5 border-t border-hairline pt-6 font-mono text-[11.5px] tracking-[0.04em] text-fg-4 [&_a]:text-fg-3 [&_a:hover]:text-accent";

export const backToTop =
  "fixed bottom-5 left-1/2 z-40 inline-flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-pill border border-hairline-2 bg-[color-mix(in_oklch,var(--color-surface)_82%,transparent)] py-1.5 pr-3 pl-2.5 font-mono text-[11px] leading-none tracking-[0.02em] text-fg-3 shadow-card backdrop-blur-[14px] backdrop-saturate-[1.2] transition-[opacity,transform,color,border-color] duration-300 ease-[cubic-bezier(0.2,0.6,0.2,1)] hover:-translate-y-px hover:border-accent-line hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[visible=false]:pointer-events-none data-[visible=false]:translate-y-3 data-[visible=false]:opacity-0";

export const backToTopArrow = "text-accent transition-transform";
