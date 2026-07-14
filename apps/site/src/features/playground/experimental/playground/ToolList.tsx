import { playground as ui } from "../../../../shared/ui.js";
import type { AgentTool } from "../agent/types.js";

interface Props {
  tools: readonly AgentTool[];
}

export function ToolList({ tools }: Props) {
  if (tools.length === 0) {
    return (
      <div className={ui.empty}>
        This skill has no tools. The agent can still respond with the Prompt API
        alone.
      </div>
    );
  }

  return (
    <ul className={ui.toolList}>
      {tools.map((tool) => {
        const tags = [
          tool.readOnly ? "read-only" : null,
          tool.destructive ? "destructive" : null,
        ].filter(Boolean) as string[];
        return (
          <li key={tool.name} className={ui.tool}>
            <div className={ui.toolHead}>
              <code className={ui.toolName}>{tool.name}</code>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={
                    tag === "destructive" ? ui.toolTagDanger : ui.toolTag
                  }
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className={ui.toolDesc}>{tool.description}</p>
          </li>
        );
      })}
    </ul>
  );
}
