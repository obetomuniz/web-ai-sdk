import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { playground as ui } from "../../../shared/ui.js";
import {
  loadPlaygroundLayoutState,
  updatePlaygroundLayoutState,
} from "./playgroundLayoutStorage.js";

const DEFAULT_SIDEBAR_WIDTH = 260;
const COLLAPSED_SIDEBAR_WIDTH = 52;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 400;
const SIDEBAR_RESIZE_STEP = 16;
const SIDEBAR_WIDTH_STORAGE_KEY = "web-ai-sdk:playground:sidebar-width";

export function usePlaygroundLayout() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [initialLayoutState] = useState(loadPlaygroundLayoutState);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [conversationsOpen, setConversationsOpen] = useState(
    initialLayoutState.conversationsOpen ?? true,
  );
  const [runtimeOpen, setRuntimeOpen] = useState(
    () =>
      initialLayoutState.runtimeOpen ??
      window.matchMedia("(min-width: 1181px)").matches,
  );
  const sidebarResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);

  const persistSidebarWidth = useCallback((width: number) => {
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width));
    } catch {
      // Storage is optional; keep the in-memory width.
    }
  }, []);

  const updateSidebarWidth = useCallback(
    (width: number) => {
      const nextWidth = clampSidebarWidth(width);
      sidebarWidthRef.current = nextWidth;
      setSidebarWidth(nextWidth);
      persistSidebarWidth(nextWidth);
    },
    [persistSidebarWidth],
  );

  const previewSidebarWidth = useCallback((width: number) => {
    const nextWidth = clampSidebarWidth(width);
    sidebarWidthRef.current = nextWidth;
    shellRef.current?.style.setProperty(
      "--playground-sidebar-width",
      `${nextWidth}px`,
    );
    shellRef.current?.style.setProperty(
      "--playground-left-column",
      `${nextWidth}px`,
    );
  }, []);

  const commitSidebarResize = useCallback(() => {
    const nextWidth = sidebarWidthRef.current;
    setSidebarWidth(nextWidth);
    setSidebarResizing(false);
    persistSidebarWidth(nextWidth);
  }, [persistSidebarWidth]);

  const startSidebarResize = (event: ReactPointerEvent<HTMLHRElement>) => {
    event.preventDefault();
    setSidebarResizing(true);
    sidebarResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: sidebarWidthRef.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resizeSidebar = (event: ReactPointerEvent<HTMLHRElement>) => {
    const resize = sidebarResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    previewSidebarWidth(resize.startWidth + event.clientX - resize.startX);
  };

  const finishSidebarResize = (event: ReactPointerEvent<HTMLHRElement>) => {
    if (sidebarResizeRef.current?.pointerId !== event.pointerId) return;
    sidebarResizeRef.current = null;
    commitSidebarResize();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleLostPointerCapture = () => {
    if (!sidebarResizeRef.current) return;
    sidebarResizeRef.current = null;
    commitSidebarResize();
  };

  const resizeSidebarFromKeyboard = (
    event: ReactKeyboardEvent<HTMLHRElement>,
  ) => {
    const step = event.shiftKey ? SIDEBAR_RESIZE_STEP * 4 : SIDEBAR_RESIZE_STEP;
    let nextWidth: number | undefined;
    if (event.key === "ArrowLeft") nextWidth = sidebarWidth - step;
    if (event.key === "ArrowRight") nextWidth = sidebarWidth + step;
    if (event.key === "Home") nextWidth = MIN_SIDEBAR_WIDTH;
    if (event.key === "End") nextWidth = MAX_SIDEBAR_WIDTH;
    if (nextWidth === undefined) return;
    event.preventDefault();
    updateSidebarWidth(nextWidth);
  };

  const setConversationsVisibility = useCallback((open: boolean) => {
    setConversationsOpen(open);
    updatePlaygroundLayoutState({ conversationsOpen: open });
  }, []);

  const setRuntimeVisibility = useCallback((open: boolean) => {
    setRuntimeOpen(open);
    updatePlaygroundLayoutState({ runtimeOpen: open });
  }, []);

  const shellStyle = {
    "--playground-sidebar-width": `${sidebarWidth}px`,
    "--playground-left-column": conversationsOpen
      ? `${sidebarWidth}px`
      : `${COLLAPSED_SIDEBAR_WIDTH}px`,
    "--playground-right-column": runtimeOpen ? "340px" : "0px",
  } as CSSProperties;

  const gridClassName = `${ui.layoutGrid} ${
    sidebarResizing ? ui.layoutGridResizing : ""
  } ${
    conversationsOpen ? ui.shellMobileWithSidebar : ui.shellMobileWithoutSidebar
  }`;

  return {
    shellRef,
    shellStyle,
    gridClassName,
    sidebarWidth,
    conversationsOpen,
    runtimeOpen,
    showConversations: () => setConversationsVisibility(true),
    hideConversations: () => setConversationsVisibility(false),
    showRuntime: () => setRuntimeVisibility(true),
    hideRuntime: () => setRuntimeVisibility(false),
    startSidebarResize,
    resizeSidebar,
    finishSidebarResize,
    handleLostPointerCapture,
    resizeSidebarFromKeyboard,
    resetSidebarWidth: () => updateSidebarWidth(DEFAULT_SIDEBAR_WIDTH),
  };
}

export type PlaygroundLayoutController = ReturnType<typeof usePlaygroundLayout>;

function clampSidebarWidth(width: number): number {
  return Math.min(
    MAX_SIDEBAR_WIDTH,
    Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)),
  );
}

function loadSidebarWidth(): number {
  try {
    const storedWidth = Number(
      window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY),
    );
    if (Number.isFinite(storedWidth) && storedWidth > 0) {
      return clampSidebarWidth(storedWidth);
    }
  } catch {
    // Storage is optional; use the default width.
  }
  return DEFAULT_SIDEBAR_WIDTH;
}
