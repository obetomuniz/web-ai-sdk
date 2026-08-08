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

// Icon-sized demo action with a custom hover/focus tooltip, mirroring the
// playground's group + absolute tooltip pattern. The tooltip anchors to the
// trigger's left edge because demo cards clip overflow.
export const demoTooltipWrap = "group/tip relative inline-flex items-center";

export const demoTooltip =
  "pointer-events-none invisible absolute bottom-[calc(100%+0.5rem)] left-0 z-50 whitespace-nowrap rounded-md bg-surface-3 px-2.5 py-1.5 font-mono text-[10px] text-fg-2 opacity-0 shadow-card transition-opacity group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100";

// Variant for triggers in a card's top row: opens below and right-aligned so
// the card's overflow clipping never cuts it.
export const demoTooltipBelow =
  "pointer-events-none invisible absolute top-[calc(100%+0.5rem)] right-0 z-50 whitespace-nowrap rounded-md bg-surface-3 px-2.5 py-1.5 font-mono text-[10px] text-fg-2 opacity-0 shadow-card transition-opacity group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100";

export const demoIconBtn =
  "inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg focus-visible:bg-surface-3 focus-visible:text-fg focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

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

export const navCenterPlaceholder =
  "h-10 w-48 justify-self-center max-[640px]:hidden";

const navCtaBase =
  "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-sm border px-3 py-2 font-mono text-[12.5px] leading-[1.55] no-underline transition-all max-[640px]:size-9 max-[640px]:p-0";

export const navCta = `${navCtaBase} border-hairline-2 text-fg-2 hover:border-accent-line hover:text-fg`;

export const navCtaPrimary = `${navCtaBase} border-accent bg-accent font-semibold text-brand-dark hover:border-accent-bright hover:bg-accent-bright`;

// Right-aligned nav action group: the icon-only Docs link plus the GitHub CTA.
export const navActions = "flex items-center justify-self-end gap-2";

export const navPlaygroundLabel = "max-[640px]:hidden";

export const navPlaygroundMark = "hidden size-4 max-[640px]:block";

// Borderless, icon-only nav button. Sits next to the GitHub CTA; a micro
// scale + color lift on hover gives it a tactile affordance without a box.
export const navIcon =
  "inline-flex items-center justify-center rounded-sm p-2 text-fg-3 transition-all duration-200 ease-out hover:scale-110 hover:text-fg";

export const navGitHubLabel = "max-[640px]:hidden";

export const navGitHubMark = "hidden size-4 fill-current max-[640px]:block";

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
  "flex flex-nowrap items-baseline gap-[0.1em] font-hero text-[clamp(54px,9vw,112px)] leading-[0.95] font-medium tracking-[-0.04em] max-[640px]:text-[56px] max-[480px]:text-[44px]";

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

export const shaderBackdrop =
  "pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_78%_42%,color-mix(in_oklch,var(--color-surface-3)_24%,transparent),transparent_58%)]";

export const shaderCanvas =
  "block h-full w-full opacity-0 transition-opacity duration-700 ease-out data-[ready=true]:opacity-100 motion-reduce:transition-none";

export const shaderFade =
  "absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,var(--color-bg)_0%,var(--color-bg)_18%,transparent_100%)]";

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

const playgroundThreadTurnBase = "grid gap-4";
const playgroundUserBubbleBase =
  "ml-auto max-w-[82%] rounded-lg rounded-br-sm bg-surface-3 px-4 py-3 text-[13px] leading-[1.55] text-fg shadow-card max-[640px]:max-w-[90%] max-[640px]:px-3.5 max-[640px]:py-2.5";
const playgroundAnswerBlockBase = "grid gap-2";
const playgroundAnswerBlockWarnBase =
  "grid gap-2 rounded-sm border-l-2 border-warn bg-[color-mix(in_oklch,var(--color-warn)_7%,transparent)] px-3 py-2";
const playgroundAnswerBlockErrorBase =
  "grid gap-2 rounded-sm border-l-2 border-err bg-[color-mix(in_oklch,var(--color-err)_7%,transparent)] px-3 py-2";
const playgroundToolCardBase =
  "overflow-hidden rounded-sm border border-hairline bg-bg transition-colors";
const playgroundToolCardWarnBase =
  "overflow-hidden rounded-sm border border-[color-mix(in_oklch,var(--color-warn)_35%,transparent)] bg-bg";
const playgroundToolCardErrorBase =
  "overflow-hidden rounded-sm border border-[color-mix(in_oklch,var(--color-err)_35%,transparent)] bg-bg";

/** Playground route: dense, responsive instrument-panel compositions. */
export const playground = {
  navTrail:
    "justify-self-center font-mono text-[11px] uppercase tracking-[0.12em] text-fg-2 max-[640px]:hidden",
  bootStack:
    "grid h-[calc(100svh-var(--nav-height))] min-h-0 [&>*]:col-start-1 [&>*]:row-start-1",
  bootLayer: "h-full min-h-0",
  bootMotionless: "[&_*]:!animate-none [&_*]:!transition-none",
  shell:
    "flex h-[calc(100svh-var(--nav-height))] min-h-0 flex-col [--playground-sidebar-width:260px] [--playground-left-column:260px] [--playground-right-column:340px] [--playground-mobile-sidebar-height:57px] overflow-hidden bg-bg text-fg",
  layoutGrid:
    "relative grid min-h-0 flex-1 grid-cols-[minmax(0,var(--playground-left-column))_minmax(0,1fr)_minmax(0,var(--playground-right-column))] transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none max-[1180px]:grid-cols-[minmax(0,var(--playground-left-column))_minmax(0,1fr)_minmax(0,0px)] max-[760px]:grid-cols-1",
  layoutGridResizing: "!transition-none",
  shellMobileWithSidebar: "max-[760px]:grid-rows-[auto_minmax(0,1fr)]",
  shellMobileWithoutSidebar: "max-[760px]:grid-rows-[minmax(0,1fr)]",
  sidebarSlot:
    "relative min-w-0 overflow-hidden max-[760px]:col-span-1 max-[760px]:w-full",
  panelSlotOpen: "pointer-events-auto",
  sidebarSlotClosed: "pointer-events-none max-[760px]:hidden",
  sidebar:
    "absolute top-0 right-0 flex h-full w-[var(--playground-sidebar-width)] shrink-0 flex-col overflow-hidden bg-surface transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity] motion-reduce:transition-none max-[760px]:static max-[760px]:h-auto max-[760px]:max-h-none max-[760px]:w-full max-[760px]:border-b max-[760px]:border-hairline",
  panelOpen: "opacity-100",
  sidebarClosed: "pointer-events-none opacity-0",
  sidebarHeader:
    "flex h-12 shrink-0 items-center justify-between px-3 max-[760px]:hidden",
  sidebarResizeHandle:
    "absolute top-0 left-[var(--playground-sidebar-width)] z-30 m-0 h-full w-3 -translate-x-1/2 cursor-col-resize touch-none border-0 bg-transparent p-0 outline-none before:pointer-events-none before:absolute before:top-1/2 before:left-1/2 before:h-10 before:w-0.5 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-transparent before:transition-[height,background-color] before:content-[''] hover:before:h-14 hover:before:bg-fg-4 focus-visible:before:h-14 focus-visible:before:bg-accent active:before:h-16 active:before:bg-accent max-[760px]:hidden",
  sidebarBody:
    "grid min-h-0 flex-1 content-start gap-7 overflow-y-auto px-3 py-4 [scrollbar-width:thin] max-[760px]:block max-[760px]:h-[var(--playground-mobile-sidebar-height)] max-[760px]:flex-none max-[760px]:overflow-x-auto max-[760px]:overflow-y-hidden max-[760px]:py-2.5",
  sidebarSection:
    "grid min-w-0 content-start gap-2 max-[760px]:flex max-[760px]:w-max max-[760px]:items-center",
  sectionTitle:
    "m-0 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-fg-4 max-[760px]:hidden",
  presets: "grid gap-1 max-[760px]:flex max-[760px]:flex-nowrap",
  threadItem:
    "grid grid-cols-[minmax(0,1fr)_2rem] items-center rounded-md bg-transparent pr-2 transition-colors hover:bg-surface-2 max-[760px]:w-48 max-[760px]:shrink-0",
  threadItemActive:
    "grid grid-cols-[minmax(0,1fr)_2rem] items-center rounded-md bg-surface-2 pr-2 max-[760px]:w-48 max-[760px]:shrink-0",
  threadSelect:
    "grid min-w-0 cursor-pointer gap-1 py-2.5 pr-1 pl-3 text-left disabled:cursor-not-allowed disabled:opacity-50",
  threadTitleRow: "flex min-w-0 items-center gap-2",
  threadStatus:
    "size-1.5 shrink-0 rounded-full bg-fg-3 data-[tone=active]:motion-safe:animate-pulse data-[tone=active]:bg-accent data-[tone=error]:bg-err data-[tone=off]:bg-fg-4",
  threadClose:
    "mt-1 inline-flex size-8 self-start cursor-pointer items-center justify-center rounded-full bg-transparent p-0 text-fg-4 transition-colors hover:text-fg focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45",
  threadCloseIcon: "size-4",
  presetName:
    "min-w-0 flex-1 truncate font-sans text-[13px] font-medium leading-snug text-fg",
  presetDesc:
    "line-clamp-2 font-sans text-[11px] leading-[1.45] text-fg-4 max-[760px]:hidden",
  wideButton:
    "inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-accent px-3 font-mono text-[10px] font-semibold text-brand-dark transition-[background-color,transform] hover:bg-accent-bright active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none max-[760px]:size-9 max-[760px]:shrink-0 max-[760px]:rounded-full max-[760px]:p-0",
  wideButtonIcon: "text-sm leading-none",
  wideButtonLabel: "max-[760px]:hidden",
  main: "flex h-full w-full min-w-0 flex-col overflow-hidden bg-bg max-[760px]:h-auto",
  mainHeader:
    "relative z-20 flex h-12 w-full min-w-0 shrink-0 bg-bg after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-9 after:bg-[linear-gradient(to_bottom,var(--color-bg)_0%,color-mix(in_oklch,var(--color-bg)_78%,transparent)_48%,transparent_100%)] after:opacity-0 after:transition-opacity after:duration-200 after:ease-out after:content-[''] max-[640px]:h-11",
  mainHeaderInner:
    "mx-auto flex h-full w-full max-w-[960px] min-w-0 items-center gap-2.5 px-3 max-[640px]:max-w-none max-[640px]:px-4",
  mainHeaderBoot: "after:transition-none",
  mainHeaderScrolled: "after:opacity-100",
  mainHeaderWithLeftRestore: "max-[760px]:pl-8",
  title:
    "m-0 min-w-0 flex-1 truncate font-display text-base font-medium leading-none tracking-[-0.02em] text-fg",
  panelRestoreLeft:
    "absolute top-2.5 left-3 z-40 motion-safe:animate-[playground-fade_180ms_ease-out_100ms_both]",
  panelRestoreRight:
    "absolute top-2.5 right-3 z-40 motion-safe:animate-[playground-fade_180ms_ease-out_100ms_both] max-[760px]:hidden",
  panelRestoreRightMobile:
    "hidden shrink-0 motion-safe:animate-[playground-fade_180ms_ease-out_100ms_both] max-[760px]:inline-flex",
  panelToggle:
    "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-transparent text-fg-4 transition-[color,background-color,transform] hover:bg-surface hover:text-fg-2 active:scale-95 focus-visible:bg-surface focus-visible:text-fg focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-accent motion-reduce:transform-none max-[760px]:size-9",
  panelToggleIcon: "size-4",
  modeSelector: "relative min-w-0 [grid-area:mode]",
  modeTrigger:
    "inline-flex min-h-9 max-w-52 cursor-pointer items-center gap-2 rounded-pill bg-bg px-3 py-2 text-left transition-colors data-[accent=info]:bg-[color-mix(in_oklch,var(--color-info)_9%,var(--color-bg))] data-[accent=ok]:bg-[color-mix(in_oklch,var(--color-ok)_9%,var(--color-bg))] data-[accent=warn]:bg-[color-mix(in_oklch,var(--color-warn)_9%,var(--color-bg))] data-[accent=violet]:bg-[color-mix(in_oklch,var(--color-info)_5%,color-mix(in_oklch,var(--color-err)_5%,var(--color-bg)))] hover:data-[accent=info]:bg-[color-mix(in_oklch,var(--color-info)_14%,var(--color-bg))] hover:data-[accent=ok]:bg-[color-mix(in_oklch,var(--color-ok)_14%,var(--color-bg))] hover:data-[accent=warn]:bg-[color-mix(in_oklch,var(--color-warn)_14%,var(--color-bg))] hover:data-[accent=violet]:bg-[color-mix(in_oklch,var(--color-info)_8%,color-mix(in_oklch,var(--color-err)_8%,var(--color-bg)))] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 data-[accent=info]:focus-visible:outline-info data-[accent=ok]:focus-visible:outline-ok data-[accent=warn]:focus-visible:outline-warn data-[accent=violet]:focus-visible:outline-[color-mix(in_oklch,var(--color-info)_45%,var(--color-err))] disabled:cursor-not-allowed disabled:opacity-45 max-[640px]:min-h-8 max-[640px]:max-w-40 max-[640px]:gap-1.5 max-[640px]:px-2.5 max-[640px]:py-1.5",
  modeTriggerName:
    "truncate font-mono text-[10px] data-[accent=info]:text-info data-[accent=ok]:text-ok data-[accent=warn]:text-warn data-[accent=violet]:text-[color-mix(in_oklch,var(--color-info)_45%,var(--color-err))]",
  modeTriggerChevron:
    "size-3.5 shrink-0 text-fg-4 transition-transform duration-150",
  modeTriggerChevronOpen:
    "size-3.5 shrink-0 rotate-180 text-fg-4 transition-transform duration-150",
  modeMenu:
    "absolute bottom-[calc(100%+0.65rem)] left-0 z-50 w-[min(440px,calc(100vw-2rem))] overflow-x-hidden rounded-xl bg-surface-3 p-2 shadow-2xl max-[640px]:fixed max-[640px]:top-auto max-[640px]:right-3 max-[640px]:bottom-3 max-[640px]:left-3 max-[640px]:max-h-[calc(100svh-var(--nav-height)-1.5rem)] max-[640px]:w-auto max-[640px]:overflow-y-auto",
  modeMenuHeader: "grid gap-1 px-3 py-3 max-[640px]:pt-2.5 max-[640px]:pb-2",
  modeMenuTitle: "font-sans text-[13px] font-medium text-fg",
  modeMenuDescription: "text-[11px] leading-relaxed text-fg-4",
  modeOptions: "grid gap-1 py-2 max-[640px]:gap-0.5 max-[640px]:py-1",
  modeOption:
    "grid w-full cursor-pointer rounded-lg bg-transparent px-3 py-3 text-left transition-colors hover:bg-surface-2 max-[640px]:py-2.5",
  modeOptionActive:
    "grid w-full cursor-pointer rounded-lg bg-surface-2 px-3 py-3 text-left max-[640px]:py-2.5",
  modeOptionCopy: "grid min-w-0 gap-1",
  modeOptionTitleRow: "flex min-w-0 items-center justify-between gap-3",
  modeOptionIdentity: "flex min-w-0 items-center gap-2.5",
  modeAccentDot:
    "size-2 shrink-0 rounded-full data-[accent=info]:bg-info data-[accent=ok]:bg-ok data-[accent=warn]:bg-warn data-[accent=violet]:bg-[color-mix(in_oklch,var(--color-info)_45%,var(--color-err))]",
  modeOptionName:
    "truncate font-sans text-[13px] font-medium data-[accent=info]:text-info data-[accent=ok]:text-ok data-[accent=warn]:text-warn data-[accent=violet]:text-[color-mix(in_oklch,var(--color-info)_45%,var(--color-err))]",
  modeOptionToolCount:
    "shrink-0 font-mono text-[8px] uppercase tracking-[0.06em] text-fg-4",
  modeOptionDescription: "text-[11px] leading-[1.45] text-fg-3",
  modeMenuNote:
    "rounded-md bg-bg px-3 py-2.5 font-mono text-[8px] leading-relaxed text-fg-4",
  mainBody:
    "grid min-h-0 w-full max-w-[960px] flex-1 self-center grid-rows-[minmax(0,1fr)_auto] gap-0 px-3 pb-4 max-[640px]:max-w-none max-[640px]:px-3 max-[640px]:pb-2",
  transcriptPanel: "relative min-h-0 overflow-hidden",
  answer:
    "h-full min-h-0 overflow-y-auto px-6 pt-5 pb-6 [scrollbar-width:thin] max-[640px]:px-4 max-[640px]:pt-4 max-[640px]:pb-5",
  banner:
    "mb-4 rounded-sm border border-[color-mix(in_oklch,var(--color-warn)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-warn)_10%,var(--color-bg))] px-3.5 py-3 font-mono text-[11px] leading-relaxed text-warn [&_code]:text-fg",
  bannerError:
    "mb-4 rounded-sm border border-[color-mix(in_oklch,var(--color-err)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-err)_10%,var(--color-bg))] px-3.5 py-3 font-mono text-[11px] leading-relaxed text-err",
  jump: "absolute right-4 bottom-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--color-surface-3)_92%,transparent)] font-mono text-[13px] text-fg-2 shadow-card backdrop-blur-sm transition-colors hover:text-fg",
  composer:
    "relative z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] [grid-template-areas:'mode_input_actions'] items-end gap-x-1.5 rounded-3xl bg-surface p-2 shadow-[0_-14px_30px_-18px_rgba(0,0,0,0.95)] transition-colors focus-within:bg-surface-2 max-[640px]:grid-cols-[minmax(0,1fr)_auto] max-[640px]:[grid-template-areas:'input_input'_'mode_actions'] max-[640px]:gap-y-1.5",
  composerDock: "relative z-20",
  composerNotices:
    "pointer-events-none absolute bottom-[calc(100%+0.65rem)] left-0 z-30 grid w-full gap-1.5",
  composerNotice:
    "pointer-events-auto flex w-full items-center gap-2.5 rounded-lg bg-[color-mix(in_oklch,var(--color-warn)_8%,var(--color-surface-3))] px-3.5 py-2.5 font-sans text-[12px] leading-relaxed text-fg-2 shadow-card backdrop-blur-sm motion-safe:animate-[playground-enter_180ms_ease-out_both]",
  composerNoticeCopy:
    "flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5",
  composerNoticeLink:
    "shrink-0 font-medium text-fg underline decoration-hairline-2 underline-offset-3 transition-colors hover:text-accent",
  composerNoticeError:
    "pointer-events-auto flex w-full items-center gap-2.5 rounded-lg bg-[color-mix(in_oklch,var(--color-err)_8%,var(--color-surface-3))] px-3.5 py-2.5 font-sans text-[12px] leading-relaxed text-fg-2 shadow-card backdrop-blur-sm motion-safe:animate-[playground-enter_180ms_ease-out_both]",
  composerNoticeIcon:
    "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--color-warn)_14%,transparent)] text-warn [&_svg]:size-3.5 [&_svg_*]:stroke-current [&_svg_*]:stroke-[1.5] [&_svg_*]:[stroke-linecap:round] [&_svg_*]:[stroke-linejoin:round]",
  composerNoticeErrorIcon:
    "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--color-err)_14%,transparent)] text-err [&_svg]:size-3.5 [&_svg_*]:stroke-current [&_svg_*]:stroke-[1.5] [&_svg_*]:[stroke-linecap:round] [&_svg_*]:[stroke-linejoin:round]",
  composerInput:
    "[grid-area:input] max-h-40 w-full resize-none overflow-y-auto border-0 bg-transparent px-1.5 py-2 font-sans text-[14px] leading-[1.55] text-fg outline-none [field-sizing:content] [scrollbar-width:thin] placeholder:text-fg-4 disabled:cursor-not-allowed disabled:opacity-55 max-[640px]:max-h-32",
  fallbackMuted: "text-fg-4",
  exampleFloat:
    "pointer-events-none absolute bottom-full left-0 flex w-full flex-wrap items-center gap-1 bg-[linear-gradient(to_top,var(--color-bg)_62%,transparent)] px-1 pt-8 pb-2.5 max-[640px]:hidden",
  examples: "flex min-w-0 flex-wrap items-center gap-1",
  example:
    "pointer-events-auto max-w-48 cursor-pointer truncate rounded-pill bg-surface-2 px-2 py-1 font-mono text-[8px] text-fg-4 transition-[color,background-color,transform] hover:bg-surface-3 hover:text-fg-2 active:scale-[0.98] motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-45",
  exampleRegenerateWrap: "group pointer-events-auto relative shrink-0",
  exampleRegenerate:
    "inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-surface-2 font-mono text-[13px] leading-none text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg focus-visible:bg-surface-3 focus-visible:text-fg focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35",
  exampleRegenerateTooltip:
    "pointer-events-none invisible absolute bottom-[calc(100%+0.5rem)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-3 px-2.5 py-1.5 font-mono text-[8px] text-fg-2 opacity-0 shadow-card transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
  composerActions: "flex shrink-0 items-center gap-1.5 [grid-area:actions]",
  toolPill: "group relative",
  toolSummaryTrigger:
    "inline-flex min-h-9 cursor-help items-center rounded-pill bg-bg px-3 py-2 font-mono text-[10px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg focus-visible:bg-surface-3 focus-visible:text-fg focus-visible:outline-none",
  toolSummaryTooltip:
    "pointer-events-none invisible absolute right-0 bottom-[calc(100%+0.65rem)] z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl bg-surface-3 p-2 opacity-0 shadow-2xl transition-[opacity,transform] duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100",
  toolSummaryHeader: "flex items-baseline justify-between gap-3 px-3 py-2.5",
  toolSummaryTitle: "font-sans text-[12px] font-medium text-fg",
  toolSummaryCount:
    "shrink-0 font-mono text-[8px] uppercase tracking-[0.08em] text-fg-4",
  toolSummaryEmpty: "m-0 px-3 py-4 text-[11px] leading-relaxed text-fg-3",
  toolSummaryList:
    "grid max-h-[min(420px,60svh)] list-none gap-1 overflow-y-auto p-0 [scrollbar-width:thin]",
  toolSummaryItem: "grid gap-1 rounded-md px-3 py-2.5 hover:bg-surface-2",
  toolSummaryItemHeader: "flex min-w-0 items-center justify-between gap-2",
  toolSummaryName: "min-w-0 truncate font-mono text-[10px] text-fg-2",
  toolSummaryTags: "flex shrink-0 items-center gap-1",
  toolSummaryTag:
    "rounded-pill bg-bg px-1.5 py-0.5 font-mono text-[7px] uppercase text-fg-4",
  toolSummaryTagDanger:
    "rounded-pill bg-[color-mix(in_oklch,var(--color-err)_10%,transparent)] px-1.5 py-0.5 font-mono text-[7px] uppercase text-err",
  toolSummaryDescription:
    "m-0 line-clamp-2 text-[10px] leading-[1.45] text-fg-4",
  sendButton:
    "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent font-sans text-lg font-medium text-brand-dark transition-[background-color,transform] hover:bg-accent-bright active:scale-95 motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-45",
  stopButton:
    "inline-flex min-h-9 cursor-pointer items-center justify-center rounded-pill bg-[color-mix(in_oklch,var(--color-err)_12%,transparent)] px-3 py-2 font-mono text-[10px] font-semibold text-err transition-colors hover:bg-[color-mix(in_oklch,var(--color-err)_20%,transparent)]",
  workspace:
    "ml-auto flex h-full w-[340px] shrink-0 flex-col overflow-hidden bg-bg transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity] motion-reduce:transition-none max-[760px]:w-full",
  workspaceSlot:
    "absolute inset-y-0 right-0 z-50 min-w-0 w-[min(340px,100%)] translate-x-0 overflow-hidden max-[1180px]:bg-bg max-[1180px]:opacity-100 max-[1180px]:transition-[opacity,transform] max-[1180px]:duration-300 max-[1180px]:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none max-[760px]:w-full",
  workspaceSlotBelowMobileSidebar:
    "max-[760px]:top-[var(--playground-mobile-sidebar-height)]",
  workspaceSlotClosed:
    "pointer-events-none max-[1180px]:translate-x-full max-[1180px]:opacity-0",
  workspaceClosed: "pointer-events-none opacity-0",
  workspaceHeader:
    "flex h-12 shrink-0 items-center justify-end gap-2 px-3 max-[760px]:absolute max-[760px]:top-2 max-[760px]:right-4 max-[760px]:z-10 max-[760px]:h-9 max-[760px]:p-0",
  workspaceHeading:
    "grid min-w-0 gap-0.5 max-[760px]:min-h-9 max-[760px]:content-center max-[760px]:pr-12",
  workspaceTitle:
    "m-0 font-display text-sm font-medium leading-none tracking-[-0.02em] text-fg",
  workspaceCount: "font-mono text-[8px] uppercase tracking-[0.06em] text-fg-4",
  workspaceBody:
    "flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3 [scrollbar-width:thin] max-[760px]:gap-3 max-[760px]:px-4 max-[760px]:pt-3 max-[760px]:pb-[max(1rem,env(safe-area-inset-bottom))]",
  workspacePane:
    "min-w-0 max-h-64 overflow-y-auto rounded-lg bg-surface [scrollbar-width:thin]",
  workspaceNotes: "mt-auto grid gap-1.5 pt-3",
  workspaceFootnote: "pb-0.5 font-mono text-[8px] leading-relaxed text-fg-4",
  workspaceAdvice: "font-sans text-[10px] leading-relaxed text-fg-4",
  empty:
    "px-4 py-5 text-center font-mono text-[10px] leading-relaxed text-fg-4",
  emptyConversation:
    "grid min-h-full place-content-center gap-2 px-6 py-12 text-center",
  emptyConversationTitle:
    "font-display text-xl font-semibold leading-tight tracking-[-0.025em] text-fg",
  emptyConversationText:
    "m-0 max-w-md font-sans text-[13px] leading-relaxed text-fg-4",
  activity: "grid list-none divide-y divide-hairline p-0",
  activityItem:
    "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-3 py-2.5 font-mono text-[8px] leading-relaxed",
  activityMeta: "grid shrink-0 justify-items-end gap-0.5",
  activityTime: "text-fg-4 tabular-nums",
  activityKind: "whitespace-nowrap uppercase text-fg-3",
  activityCheckState:
    "shrink-0 whitespace-nowrap uppercase text-fg-3 data-[tone=ready]:text-ok data-[tone=download]:text-warn data-[tone=downloading]:text-warn data-[tone=unavailable]:text-err",
  activityMain: "grid min-w-0 gap-0.5",
  activityMessage: "truncate text-fg-2",
  activityDetail: "truncate text-fg-4",
  threadTranscript: "grid gap-8 max-[640px]:gap-6",
  threadTurn: `${playgroundThreadTurnBase} motion-safe:animate-[playground-enter_180ms_ease-out_both]`,
  threadTurnStatic: playgroundThreadTurnBase,
  userBubble: `${playgroundUserBubbleBase} motion-safe:animate-[playground-enter_160ms_ease-out_both]`,
  userBubbleStatic: playgroundUserBubbleBase,
  transcript: "grid gap-3",
  turn: "grid gap-3",
  answerMarkdown:
    "min-w-0 text-[13px] leading-7 text-fg-2 [&_a]:text-fg [&_a]:underline [&_a]:decoration-hairline-2 [&_a]:underline-offset-3 [&_blockquote]:border-l-2 [&_blockquote]:border-hairline-2 [&_blockquote]:pl-4 [&_code]:font-mono [&_h1]:font-display [&_h1]:text-xl [&_h1]:text-fg [&_h2]:font-display [&_h2]:text-lg [&_h2]:text-fg [&_h3]:font-display [&_h3]:text-base [&_h3]:text-fg [&_li]:my-0.5 [&_li]:pl-1 [&_li]:marker:text-fg-4 [&_li>p]:my-0 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol_ol]:my-1 [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:border [&_pre]:border-hairline [&_pre]:bg-bg [&_pre]:p-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul_ul]:my-1 [&_ul_ul]:list-[circle]",
  bootMessage: "m-0 whitespace-pre-wrap",
  markdownInlineCode:
    "rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[0.88em] text-fg",
  working:
    "inline-flex w-fit items-center gap-2 rounded-pill border border-hairline bg-bg px-3 py-1.5 font-mono text-[10px] text-fg-3 motion-safe:animate-[playground-fade_140ms_ease-out_both]",
  workingDots: "inline-flex items-center gap-1",
  workingDot: "size-1 rounded-full bg-fg-3 motion-safe:animate-pulse",
  workingTimer: "text-fg-4 tabular-nums",
  answerBlock: `${playgroundAnswerBlockBase} motion-safe:animate-[playground-fade_160ms_ease-out_both]`,
  answerBlockStatic: playgroundAnswerBlockBase,
  answerBlockWarn: `${playgroundAnswerBlockWarnBase} motion-safe:animate-[playground-enter_180ms_ease-out_both]`,
  answerBlockWarnStatic: playgroundAnswerBlockWarnBase,
  answerBlockError: `${playgroundAnswerBlockErrorBase} motion-safe:animate-[playground-enter_180ms_ease-out_both]`,
  answerBlockErrorStatic: playgroundAnswerBlockErrorBase,
  answerHead: "flex items-center justify-between",
  answerLabel: "font-mono text-[9px] uppercase tracking-[0.12em] text-fg-4",
  answerPlaceholder: "font-mono text-[10px] leading-relaxed text-fg-4",
  failureDetails: "mt-1 font-mono text-[9px] text-fg-4",
  failureSummary:
    "w-fit cursor-pointer select-none transition-colors hover:text-fg-2",
  failureCode:
    "mt-2 block overflow-x-auto rounded-sm bg-bg px-2.5 py-2 leading-relaxed text-fg-3",
  stop: "font-mono text-[9px] uppercase tracking-[0.08em] text-fg-4",
  stopWarn: "font-mono text-[9px] uppercase tracking-[0.08em] text-warn",
  stopError: "font-mono text-[9px] uppercase tracking-[0.08em] text-err",
  toolCards: "grid list-none gap-2 p-0",
  toolCard: `${playgroundToolCardBase} motion-safe:animate-[playground-enter_160ms_ease-out_both]`,
  toolCardStatic: playgroundToolCardBase,
  toolCardCalling:
    "overflow-hidden rounded-sm border border-accent-line bg-bg transition-colors motion-safe:animate-[playground-enter_160ms_ease-out_both]",
  toolCardWarn: playgroundToolCardWarnBase,
  toolCardWarnStatic: playgroundToolCardWarnBase,
  toolCardError: playgroundToolCardErrorBase,
  toolCardErrorStatic: playgroundToolCardErrorBase,
  toolCardDisclosure: "group",
  toolCardHead:
    "flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 font-mono text-[10px] [&::-webkit-details-marker]:hidden",
  toolCardIdentity: "flex min-w-0 items-center gap-2",
  toolCardChevron:
    "shrink-0 text-sm leading-none text-fg-4 transition-transform group-open:rotate-90",
  toolCardName: "truncate text-fg-2",
  toolStatus: "shrink-0 uppercase tracking-[0.06em] text-fg-4",
  toolStatusCalling: "shrink-0 uppercase text-accent motion-safe:animate-pulse",
  toolStatusWarn: "shrink-0 uppercase text-warn",
  toolStatusError: "shrink-0 uppercase text-err",
  toolProgress: "grid list-none gap-1 border-t border-hairline px-3 py-2",
  toolProgressItem:
    "flex min-w-0 items-center gap-2 font-mono text-[9px] text-fg-4",
  toolProgressDot: "size-1 shrink-0 rounded-full bg-accent",
  toolDetails: "border-t border-hairline",
  toolSummary:
    "cursor-pointer truncate px-3 py-2 font-mono text-[9px] text-fg-4 hover:text-fg-2",
  toolJson:
    "max-h-48 overflow-auto border-t border-hairline bg-surface px-3 py-2 font-mono text-[9px] leading-relaxed text-fg-3",
  toolItem: "grid gap-1 rounded-sm border border-hairline bg-bg px-3 py-2",
  toolItemHead: "flex items-center justify-between gap-3",
  toolItemName: "font-mono text-[10px] text-fg-2",
  toolItemStatus: "font-mono text-[9px] uppercase text-fg-4",
  toolItemBody: "truncate font-mono text-[9px] text-fg-4",
  responseActions: "mt-1 flex w-fit items-center gap-0.5",
  responseAction: "group relative",
  responseActionTrigger:
    "inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-transparent text-fg-4 transition-colors hover:bg-surface-2 hover:text-fg-2 focus-visible:bg-surface-2 focus-visible:text-fg focus-visible:outline-none",
  responseActionIcon: "size-3.5",
  responseActionTooltip:
    "pointer-events-none invisible absolute bottom-[calc(100%+0.5rem)] left-0 z-50 whitespace-nowrap rounded-md bg-surface-3 px-2.5 py-1.5 font-mono text-[8px] text-fg-3 opacity-0 shadow-card transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
  streamStats: "group relative w-fit",
  streamStatsTrigger:
    "inline-flex size-6 cursor-help items-center justify-center rounded-full bg-transparent text-fg-4 transition-colors hover:bg-surface-2 hover:text-fg-2 focus-visible:bg-surface-2 focus-visible:text-fg focus-visible:outline-none",
  streamStatsIcon: "size-3.5",
  streamStatsTooltip:
    "pointer-events-none invisible absolute bottom-[calc(100%+0.5rem)] left-0 z-50 flex items-center gap-2 whitespace-nowrap rounded-md bg-surface-3 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.06em] text-fg-3 opacity-0 shadow-card",
  streamStatsTooltipVisible: "visible opacity-100",
  thinking: "inline-flex items-center gap-2 font-mono text-[10px] text-fg-3",
  thinkingVerb: "min-w-16",
  thinkingDots: "inline-flex gap-1",
  thinkingDot: "size-1 rounded-full bg-fg-3 motion-safe:animate-pulse",
} as const;
