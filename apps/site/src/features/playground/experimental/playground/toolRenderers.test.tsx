import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveToolRenderer, validCorrectionRange } from "./toolRenderers.js";

describe("Proofreader presentation", () => {
  it("retains offsets and optional metadata with safe text output", () => {
    const Renderer = resolveToolRenderer();
    const html = renderToStaticMarkup(
      <Renderer
        animate={false}
        tool={{
          callId: "test",
          name: "proofread_text",
          input: {},
          pending: false,
          progress: [],
          output: {
            original: "I seen him.",
            checkedText: "I seen him.",
            correctedInput: "I saw him.",
            cached: true,
            corrections: [
              {
                startIndex: 2,
                endIndex: 6,
                correction: "saw",
                type: "grammar",
                explanation: "<script>alert(1)</script>",
              },
              { startIndex: -5, endIndex: 100, correction: "unsafe" },
              {
                startIndex: { malformed: true },
                endIndex: null,
                correction: "unsafe",
              },
            ],
          },
        }}
      />,
    );
    expect(html).toContain("I saw him.");
    expect(html).toContain("I seen him.");
    expect(html).toContain("Type: grammar");
    expect(html).toContain("Invalid display range");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it.each([
    [-1, 1],
    [0, 100],
    [2, 1],
    [0.5, 2],
    [0, Number.NaN],
  ])("rejects display range %s:%s", (startIndex, endIndex) => {
    expect(
      validCorrectionRange("original", {
        startIndex,
        endIndex,
        correction: "replacement",
      }),
    ).toBe(false);
  });
});
