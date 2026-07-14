import type { ReactElement } from "react";
import { playground as ui } from "../../../../../shared/ui.js";
import type {
  A2uiComponentNode,
  A2uiSnapshot,
  A2uiSurfaceSnapshot,
} from "../../agent/a2ui/index.js";

function literalString(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const lit = (value as { literalString?: string }).literalString;
  return typeof lit === "string" ? lit : undefined;
}

function childIds(children: unknown): string[] {
  if (!children || typeof children !== "object") return [];
  const explicit = (children as { explicitList?: string[] }).explicitList;
  return Array.isArray(explicit) ? explicit : [];
}

function textRole(id: string): "title" | "subtitle" | "body" {
  if (id === "title") return "title";
  if (id === "subtitle") return "subtitle";
  return "body";
}

interface MetricItem {
  label: string;
  value: number;
  max?: number;
  unit?: string;
}

function parseMetricItems(raw: unknown): MetricItem[] {
  if (!raw || typeof raw !== "object") return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .filter(
      (it): it is MetricItem =>
        !!it &&
        typeof it === "object" &&
        typeof (it as { label?: unknown }).label === "string" &&
        typeof (it as { value?: unknown }).value === "number",
    )
    .map((it) => ({
      label: String(it.label),
      value: it.value,
      max: typeof it.max === "number" ? it.max : undefined,
      unit: typeof it.unit === "string" ? it.unit : undefined,
    }));
}

function formatMetricValue(value: number, unit?: string): string {
  const base =
    Number.isInteger(value) || Math.abs(value) >= 10
      ? String(value)
      : value.toFixed(1);
  return unit ? `${base}${unit}` : base;
}

function renderNode(
  id: string,
  surface: A2uiSurfaceSnapshot,
  data: Record<string, unknown>,
): ReactElement | null {
  const node = surface.components[id];
  if (!node) return null;

  const entries = Object.entries(node.component);
  if (entries.length === 0) return null;
  const entry = entries[0];
  if (!entry) return null;
  const [type, props] = entry;
  const p = (props ?? {}) as Record<string, unknown>;

  switch (type) {
    case "Text": {
      const text =
        literalString(p.text) ?? (typeof p.text === "string" ? p.text : id);
      const role = textRole(id);
      if (role === "title") {
        return <h2 className={ui.a2uiHeading}>{text}</h2>;
      }
      if (role === "subtitle") {
        return <p className={ui.a2uiLead}>{text}</p>;
      }
      return <p className={ui.a2uiText}>{text}</p>;
    }
    case "Divider":
      return <hr className={ui.a2uiDivider} />;
    case "Button": {
      const label = literalString(p.label) ?? literalString(p.text) ?? "Button";
      return (
        <div className={ui.a2uiActions}>
          <button type="button" className={ui.a2uiButton}>
            {label}
          </button>
        </div>
      );
    }
    case "TextField": {
      const label = literalString(p.label) ?? "Field";
      const placeholder = literalString(p.placeholder) ?? "";
      return (
        <label className={ui.a2uiField}>
          <span className={ui.a2uiFieldLabel}>{label}</span>
          <input
            type="text"
            className={ui.a2uiFieldInput}
            readOnly
            placeholder={placeholder}
            aria-label={label}
          />
        </label>
      );
    }
    case "Column": {
      const ids = childIds(p.children);
      const layoutClass = id === "card_body" ? ui.a2uiStack : ui.a2uiColumn;
      return (
        <div className={layoutClass}>
          {ids.map((cid) => (
            <div key={cid} className={ui.a2uiSlot}>
              {renderNode(cid, surface, data)}
            </div>
          ))}
        </div>
      );
    }
    case "Row": {
      const ids = childIds(p.children);
      return (
        <div className={ui.a2uiRow}>
          {ids.map((cid) => (
            <div key={cid} className={ui.a2uiSlot}>
              {renderNode(cid, surface, data)}
            </div>
          ))}
        </div>
      );
    }
    case "Card": {
      const child = typeof p.child === "string" ? p.child : undefined;
      return (
        <article className={ui.a2uiCard}>
          {child ? renderNode(child, surface, data) : null}
        </article>
      );
    }
    case "List": {
      const ids = childIds(p.children);
      return (
        <ul className={ui.a2uiList}>
          {ids.map((cid) => (
            <li key={cid}>{renderNode(cid, surface, data)}</li>
          ))}
        </ul>
      );
    }
    case "Chart": {
      const items = parseMetricItems(p);
      if (items.length === 0) return null;
      const maxVal = Math.max(...items.map((it) => it.max ?? it.value), 1);
      return (
        <div className={ui.a2uiChart} role="img" aria-label="Bar chart">
          <ul className={ui.a2uiChartBars}>
            {items.map((it) => {
              const pct = Math.min(100, (it.value / maxVal) * 100);
              return (
                <li key={it.label} className={ui.a2uiChartBar}>
                  <div className={ui.a2uiChartTrack}>
                    <div
                      className={ui.a2uiChartFill}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className={ui.a2uiChartValue}>
                    {formatMetricValue(it.value, it.unit)}
                  </span>
                  <span className={ui.a2uiChartLabel}>{it.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
    case "StatRow": {
      const items = parseMetricItems(p);
      if (items.length === 0) return null;
      return (
        <fieldset
          className={`${ui.a2uiStats} border-0 p-0`}
          aria-label="Metrics"
        >
          {items.map((it) => (
            <div key={it.label} className={ui.a2uiStat}>
              <span className={ui.a2uiStatValue}>
                {formatMetricValue(it.value, it.unit)}
              </span>
              <span className={ui.a2uiStatLabel}>{it.label}</span>
            </div>
          ))}
        </fieldset>
      );
    }
    default:
      return (
        <div className={ui.a2uiUnknown} title={type}>
          [{type}]
        </div>
      );
  }
}

interface Props {
  snapshot: A2uiSnapshot;
  streaming?: boolean;
}

export function A2uiView({ snapshot, streaming }: Props) {
  const surfaces = Object.values(snapshot).filter((s) => s.ready && s.rootId);
  if (surfaces.length === 0) {
    return (
      <p className={ui.a2uiPlaceholder}>
        {streaming
          ? "Building generative UI..."
          : "No A2UI surface ready (waiting for beginRendering)."}
      </p>
    );
  }

  return (
    <div className={ui.a2uiRoot}>
      {surfaces.map((surface) => (
        <section
          key={surface.surfaceId}
          className={ui.a2uiSurface}
          data-surface={surface.surfaceId}
          aria-label="Generated UI"
        >
          {surface.rootId
            ? renderNode(surface.rootId, surface, surface.dataModel)
            : null}
        </section>
      ))}
    </div>
  );
}

export type { A2uiComponentNode };
