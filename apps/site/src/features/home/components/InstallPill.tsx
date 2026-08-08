import { useState } from "react";

/**
 * One-click install command. Renders as a single `<button>` so the entire
 * pill is a click target and keyboard activation works automatically (no
 * role+tabIndex+keydown gymnastics needed).
 */
export const InstallPill = ({
  pkg = "@web-ai-sdk/prompt",
  className = "",
}: {
  pkg?: string;
  className?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`npm install ${pkg}`);
    } catch {
      // Clipboard unavailable in some browsers / contexts; silently no-op.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      className={`inline-flex h-10 max-w-full items-center gap-3.5 rounded-sm border border-hairline bg-surface pl-4 pr-0 font-mono text-[13px] text-fg-2 transition-colors hover:border-accent-line max-[480px]:gap-2 max-[480px]:pl-3 max-[480px]:text-xs ${className}`}
      onClick={copy}
    >
      <span className="select-none text-fg-4">$</span>
      <span className="truncate text-fg">
        npm install <span className="text-accent">{pkg}</span>
      </span>
      <span
        className={`ml-1.5 inline-flex h-8 min-w-14 items-center justify-center self-center border-l border-hairline px-3.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors hover:text-accent max-[480px]:px-2.5 ${copied ? "text-ok" : "text-fg-3"}`}
      >
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
};
