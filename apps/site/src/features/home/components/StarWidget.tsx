import { useEffect, useState } from "react";

export const StarWidget = ({
  repo = "obetomuniz/web-ai-sdk",
}: {
  repo?: string;
}) => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stargazers_count != null) setCount(d.stargazers_count);
      })
      .catch(() => {
        // Silent; the widget just shows "-" if the API is unreachable.
      });
  }, [repo]);

  return (
    <a
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-stretch overflow-hidden rounded-sm border border-hairline-2 font-mono text-[12.5px] transition-colors hover:border-accent-line"
    >
      <span className="inline-flex items-center gap-2 bg-surface-2 px-3 py-2 text-fg">
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
        </svg>
        Star
      </span>
      <span className="inline-flex items-center gap-2 border-l border-hairline bg-surface px-3 py-2 text-accent-bright">
        <span className="tabular-nums">
          {count != null ? count.toLocaleString() : "-"}
        </span>
      </span>
    </a>
  );
};
