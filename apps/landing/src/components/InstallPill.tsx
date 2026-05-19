import { useState } from "react";

/**
 * One-click install command. Renders as a single `<button>` so the entire
 * pill is a click target and keyboard activation works automatically (no
 * role+tabIndex+keydown gymnastics needed).
 */
export const InstallPill = ({
  pkg = "@web-ai-sdk/prompt",
}: { pkg?: string }) => {
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
    <button type="button" className="install-pill" onClick={copy}>
      <span className="prompt">$</span>
      <span className="cmd">
        npm install <span className="pkg">{pkg}</span>
      </span>
      <span className={`copy ${copied ? "copied" : ""}`}>
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
};
