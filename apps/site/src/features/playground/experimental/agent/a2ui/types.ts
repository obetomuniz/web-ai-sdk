/**
 * A2UI v0.8 server→client message shapes (JSONL stream).
 * @see https://a2ui.org/specification/v0_8/
 */

export const A2UI_V0_8_STANDARD_CATALOG =
  "https://a2ui.org/specification/v0_8/standard_catalog_definition.json";

export const A2UI_SERVER_MESSAGE_KEYS = [
  "surfaceUpdate",
  "dataModelUpdate",
  "beginRendering",
  "deleteSurface",
] as const;

export type A2uiServerMessageKey = (typeof A2UI_SERVER_MESSAGE_KEYS)[number];

export interface A2uiComponentNode {
  id: string;
  component: Record<string, unknown>;
}

export interface SurfaceUpdatePayload {
  surfaceId?: string;
  components: A2uiComponentNode[];
}

export interface DataModelUpdatePayload {
  surfaceId?: string;
  /** Full replacement or patch - we store the latest object per surface. */
  contents?: Record<string, unknown>;
  path?: string;
  value?: unknown;
}

export interface BeginRenderingPayload {
  surfaceId?: string;
  root: string;
  catalogId?: string;
  styles?: Record<string, unknown>;
}

export interface DeleteSurfacePayload {
  surfaceId: string;
}

export type A2uiServerMessage =
  | { surfaceUpdate: SurfaceUpdatePayload }
  | { dataModelUpdate: DataModelUpdatePayload }
  | { beginRendering: BeginRenderingPayload }
  | { deleteSurface: DeleteSurfacePayload };

export interface A2uiSurfaceSnapshot {
  surfaceId: string;
  components: Record<string, A2uiComponentNode>;
  dataModel: Record<string, unknown>;
  ready: boolean;
  rootId?: string;
  catalogId?: string;
}

export type A2uiSnapshot = Record<string, A2uiSurfaceSnapshot>;
