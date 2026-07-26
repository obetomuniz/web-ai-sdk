import { useCallback, useState } from "react";
import type { ActivityEvent } from "./types.js";

const MAX_ACTIVITY = 50;

export function useActivityLog() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const push = useCallback((event: Omit<ActivityEvent, "id" | "ts">) => {
    setEvents((current) =>
      [{ id: crypto.randomUUID(), ts: Date.now(), ...event }, ...current].slice(
        0,
        MAX_ACTIVITY,
      ),
    );
  }, []);

  return { events, push };
}
