import { afterEach, describe, expect, it, vi } from "vitest";
import { createFetchUrlTool } from "./fetchUrl.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createFetchUrlTool", () => {
  it("cancels a streamed response after reaching the byte limit", async () => {
    const encoder = new TextEncoder();
    let cancelled = false;
    let chunk = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          const value = ["12345", "67890"][chunk];
          chunk += 1;
          if (value) {
            controller.enqueue(encoder.encode(value));
          }
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(body, {
          headers: { "content-type": "text/plain" },
        });
      }),
    );

    const result = await createFetchUrlTool({ maxBytes: 5 }).execute(
      { url: "https://example.test/large.txt" },
      {
        signal: new AbortController().signal,
        callId: "fetch-1",
        step: 0,
        emit: vi.fn(),
      },
    );

    expect(result).toMatchObject({
      truncated: true,
      format: "text",
      text: "12345",
    });
    expect(cancelled).toBe(true);
  });
});
