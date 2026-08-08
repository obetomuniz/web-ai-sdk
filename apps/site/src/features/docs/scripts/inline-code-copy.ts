// Click-to-copy for inline code in the docs content. Hovering an inline
// `code` span shows a minimal "Copy" tooltip; clicking copies the code text
// and flashes "Copied!". Fenced code blocks keep expressive-code's own copy
// button, and code rendered inside links keeps its navigation behavior.
const CODE_SELECTOR = ".sl-markdown-content code";
const RESET_DELAY = 1200;

let tip: HTMLDivElement | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function getTip(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "inline-code-tip";
    tip.setAttribute("role", "status");
    document.body.append(tip);
  }
  return tip;
}

function showTip(code: HTMLElement, label: string) {
  const el = getTip();
  const rect = code.getBoundingClientRect();
  el.textContent = label;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top}px`;
  el.setAttribute("data-show", "");
}

function hideTip() {
  tip?.removeAttribute("data-show");
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (permission or insecure context): fall back
    // to a transient textarea and the legacy copy command.
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function enhanceInlineCode() {
  for (const code of document.querySelectorAll<HTMLElement>(CODE_SELECTOR)) {
    if (code.closest("pre") || code.closest("a") || code.closest(".expressive-code")) {
      continue;
    }

    code.classList.add("inline-code-copy");

    code.addEventListener("mouseenter", () => {
      clearTimeout(hideTimer);
      showTip(code, "Copy");
    });

    code.addEventListener("mouseleave", hideTip);

    code.addEventListener("click", async () => {
      const copied = await copyText(code.textContent ?? "");
      showTip(code, copied ? "Copied!" : "Copy failed");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideTip, RESET_DELAY);
    });
  }
}

// A fixed-position tooltip drifts away from its anchor once the page scrolls.
window.addEventListener("scroll", hideTip, { passive: true, capture: true });

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enhanceInlineCode, {
    once: true,
  });
} else {
  enhanceInlineCode();
}
