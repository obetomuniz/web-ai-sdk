// String-literal type unions in inline code — `"a" | "b" | "c"` — render as
// one long chip that wraps mid-token inside option tables. Split them into
// one pill per union member; the wrapper flex-wraps between pills, so long
// unions break cleanly. Runs before inline-code-copy.ts (import order in
// Head.astro), so each pill gets its own copy affordance.
const UNION_CODE_SELECTOR = ".sl-markdown-content code";
const STRING_UNION = /^"[^"]*"(?:\s*\|\s*"[^"]*")+$/;

function splitUnionPills() {
  for (const code of document.querySelectorAll<HTMLElement>(
    UNION_CODE_SELECTOR,
  )) {
    if (
      code.closest("pre") ||
      code.closest("a") ||
      code.closest(".expressive-code")
    ) {
      continue;
    }

    const text = code.textContent?.trim() ?? "";
    if (!STRING_UNION.test(text)) continue;

    const wrap = document.createElement("span");
    wrap.className = "type-union";
    for (const member of text.split("|")) {
      const pill = document.createElement("code");
      pill.textContent = member.trim();
      wrap.append(pill);
    }
    code.replaceWith(wrap);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", splitUnionPills, {
    once: true,
  });
} else {
  splitUnionPills();
}
