import { useId } from "react";
import { playground as ui } from "../../../../shared/ui.js";
import type { AgentTool } from "../agent/types.js";

interface Props {
  tools: readonly AgentTool[];
}

export function ToolSummary({ tools }: Props) {
  const tooltipId = useId();
  const label =
    tools.length === 0
      ? "No tools"
      : `${tools.length} tool${tools.length === 1 ? "" : "s"}`;

  return (
    <div className={ui.toolPill}>
      <button
        type="button"
        className={ui.toolSummaryTrigger}
        aria-describedby={tooltipId}
      >
        <span>{label}</span>
      </button>
      <div id={tooltipId} role="tooltip" className={ui.toolSummaryTooltip}>
        <div className={ui.toolSummaryHeader}>
          <span className={ui.toolSummaryTitle}>Available tools</span>
          <span className={ui.toolSummaryCount}>{label}</span>
        </div>
        {tools.length === 0 ? (
          <p className={ui.toolSummaryEmpty}>
            This mode answers through the Prompt API without calling tools.
          </p>
        ) : (
          <ul className={ui.toolSummaryList}>
            {tools.map((tool) => {
              const tags = [
                tool.readOnly ? "read-only" : null,
                tool.destructive ? "destructive" : null,
              ].filter(Boolean) as string[];
              return (
                <li key={tool.name} className={ui.toolSummaryItem}>
                  <div className={ui.toolSummaryItemHeader}>
                    <code className={ui.toolSummaryName}>{tool.name}</code>
                    <span className={ui.toolSummaryTags}>
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className={
                            tag === "destructive"
                              ? ui.toolSummaryTagDanger
                              : ui.toolSummaryTag
                          }
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  </div>
                  <p className={ui.toolSummaryDescription}>
                    {tool.description}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
