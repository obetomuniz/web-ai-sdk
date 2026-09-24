// @vitest-environment happy-dom
import { clearTranslatorSessions } from "@web-ai-sdk/translator";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { resolveToolRenderer } from "./toolRenderers.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it("shows the latest cumulative text without concatenating updates", () => {
  const Renderer = resolveToolRenderer();
  const html = renderToStaticMarkup(
    <Renderer
      tool={{
        callId: "write",
        name: "write_text",
        input: { task: "Draft" },
        pending: true,
        progress: [
          { phase: "output", text: "Hello" },
          { phase: "output", text: "Hello world" },
        ],
      }}
    />,
  );
  expect(html).toContain("Hello world");
  expect(html.match(/Hello/g)).toHaveLength(1);
});

it("renders original text safely even when correction offsets are invalid", () => {
  const Renderer = resolveToolRenderer();
  const html = renderToStaticMarkup(
    <Renderer
      tool={{
        callId: "proofread",
        name: "proofread_text",
        input: { text: "<script>original</script>" },
        progress: [],
        pending: false,
        output: {
          cached: false,
          output: {
            correctedInput: "<img src=x onerror=alert(1)>",
            corrections: [
              {
                startIndex: -1,
                endIndex: 9999,
                correction: "replacement",
                type: "grammar",
                explanation: "Explanation preserved",
              },
            ],
          },
        },
      }}
    />,
  );
  expect(html).toContain("Invalid display offsets; original text preserved");
  expect(html).toContain("&lt;script&gt;original&lt;/script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img");
  expect(html).toContain("Explanation preserved");
});

it("offers a model download while the call's model is downloadable", async () => {
  const availability = vi.fn(async () => "downloadable");
  const create = vi.fn(async () => ({
    translate: async () => "",
    destroy() {},
  }));
  vi.stubGlobal("Translator", { availability, create });
  const tool = {
    callId: "translate",
    name: "translate_text",
    input: { text: "こんにちは", sourceLanguage: "ja", targetLanguage: "pt" },
    progress: [],
    pending: false,
    error: {
      name: "TranslatorUnavailableError",
      message: "Translator.create() failed: Requires a user gesture",
    },
  };
  const Renderer = resolveToolRenderer();
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <ul>
          <Renderer tool={tool} />
        </ul>,
      ),
    );
    expect(availability).toHaveBeenCalledWith({
      sourceLanguage: "ja",
      targetLanguage: "pt",
    });
    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "Download model",
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
    await vi.waitFor(() =>
      expect(container.textContent).toContain("Model ready"),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLanguage: "ja", targetLanguage: "pt" }),
    );

    availability.mockResolvedValue("unavailable");
    await act(async () =>
      root.render(
        <ul>
          <Renderer
            tool={{ ...tool, callId: "other", input: { ...tool.input } }}
          />
        </ul>,
      ),
    );
    expect(container.textContent).not.toContain("Download model");
  } finally {
    act(() => root.unmount());
    clearTranslatorSessions();
    vi.unstubAllGlobals();
  }
});
