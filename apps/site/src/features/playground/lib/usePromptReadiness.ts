import {
  checkAvailability,
  isAvailable as isPromptAvailable,
} from "@web-ai-sdk/prompt";
import { useEffect, useMemo, useState } from "react";
import { type PromptReadiness, promptIsReady } from "./promptReadiness.js";

export function usePromptReadiness() {
  const exposed = useMemo(() => isPromptAvailable(), []);
  const [readiness, setReadiness] = useState<PromptReadiness>(
    exposed ? "checking" : "unavailable",
  );

  // Availability probing is asynchronous. Keep the composer optimistic while
  // it runs so the initial render does not flash an unavailable state. A
  // warning is reserved for a definitive unavailable or download-required
  // result.
  useEffect(() => {
    if (!exposed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const inspect = async () => {
      const availability = await checkAvailability({
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      });
      if (cancelled) return;
      setReadiness(availability ?? "unknown");
      if (availability === "downloadable" || availability === "downloading") {
        timer = setTimeout(inspect, 2_000);
      }
    };
    void inspect();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [exposed]);

  return {
    promptReadiness: readiness,
    promptOn: promptIsReady(readiness),
  };
}
