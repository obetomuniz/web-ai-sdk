import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import { isTranslatorAvailable, translate } from "./index.js";

interface CreateOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?: (m: {
    addEventListener: (
      type: "downloadprogress",
      cb: (e: { loaded: number }) => void,
    ) => void;
  }) => void;
}

const installFakeTranslator = (
  translateImpl?: (text: string) => Promise<string>,
) => {
  const calls: string[] = [];
  const impl = translateImpl ?? (async (text: string) => `[t]${text}`);

  const api = {
    availability: vi.fn(async () => "available" as const),
    create: vi.fn(async (_options: CreateOptions) => ({
      translate: vi.fn(async (text: string) => {
        calls.push(text);
        return impl(text);
      }),
    })),
  };
  (globalThis as { Translator?: typeof api }).Translator = api;
  return { api, calls };
};

const removeFakeTranslator = () => {
  (globalThis as { Translator?: unknown }).Translator = undefined;
};

beforeEach(() => {
  __clearSessionCacheForTests();
  document.body.innerHTML = "";
});

afterEach(() => {
  removeFakeTranslator();
});

describe("isTranslatorAvailable", () => {
  it("is false when the global is missing", () => {
    expect(isTranslatorAvailable()).toBe(false);
  });

  it("is true when the global is present", () => {
    installFakeTranslator();
    expect(isTranslatorAvailable()).toBe(true);
  });
});

describe("translate", () => {
  it("returns a no-op controller when WebMCP source and target match", async () => {
    installFakeTranslator();
    const ctrl = translate({ sourceLanguage: "en", targetLanguage: "en" });
    await expect(ctrl.done).resolves.toEqual({ blocksTranslated: 0 });
  });

  it("returns a no-op controller when the global is missing", async () => {
    document.body.innerHTML =
      "<article data-translate-root><p>Olá mundo</p></article>";
    const ctrl = translate({ sourceLanguage: "pt", targetLanguage: "en" });
    await expect(ctrl.done).resolves.toEqual({ blocksTranslated: 0 });
  });

  it("translates each leaf block and replaces children", async () => {
    installFakeTranslator(async (text) => text.replace("Olá", "Hello"));
    document.body.innerHTML =
      "<article data-translate-root>" +
      "<p>Olá mundo</p>" +
      "<p>Olá <strong>amigo</strong>.</p>" +
      "</article>";

    const ctrl = translate({ sourceLanguage: "pt", targetLanguage: "en" });
    const result = await ctrl.done;
    expect(result.blocksTranslated).toBe(2);

    const ps = document.querySelectorAll("p");
    expect(ps[0]?.textContent).toBe("Hello mundo");
    expect(ps[1]?.querySelector("strong")?.textContent).toBe("amigo");
  });

  it("emits progress events through the full lifecycle", async () => {
    installFakeTranslator();
    document.body.innerHTML =
      "<article data-translate-root><p>Hi</p><p>Bye</p></article>";

    const events: string[] = [];
    const ctrl = translate({
      sourceLanguage: "pt",
      targetLanguage: "en",
      onProgress: (e) => events.push(e.phase),
    });
    await ctrl.done;
    expect(events[0]).toBe("loading-model");
    expect(events).toContain("translating");
    expect(events.filter((p) => p === "block-translated")).toHaveLength(2);
    expect(events.at(-1)).toBe("done");
  });

  it("skips blocks that are entirely opaque tokens (e.g. inline <code> only)", async () => {
    const { calls } = installFakeTranslator();
    document.body.innerHTML =
      "<article data-translate-root><p><code>const x = 1</code></p></article>";

    const ctrl = translate({ sourceLanguage: "pt", targetLanguage: "en" });
    await ctrl.done;
    expect(calls).toHaveLength(0);
  });

  it("skips standalone untranslatable tokens like 'PWA'", async () => {
    const { calls } = installFakeTranslator();
    document.body.innerHTML =
      "<article data-translate-root><h2>PWA</h2></article>";

    const ctrl = translate({ sourceLanguage: "pt", targetLanguage: "en" });
    await ctrl.done;
    expect(calls).toHaveLength(0);
  });

  it("ignores blocks inside <pre>", async () => {
    const { calls } = installFakeTranslator();
    document.body.innerHTML =
      "<article data-translate-root>" +
      "<pre><p>código</p></pre>" +
      "<p>texto</p>" +
      "</article>";

    const ctrl = translate({ sourceLanguage: "pt", targetLanguage: "en" });
    await ctrl.done;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe("texto");
  });

  it("restore() returns blocks to their original children", async () => {
    installFakeTranslator(async (text) => text.replace("Olá", "Hello"));
    document.body.innerHTML =
      "<article data-translate-root><p>Olá mundo</p></article>";
    const original = document.querySelector("p")?.textContent;

    const ctrl = translate({ sourceLanguage: "pt", targetLanguage: "en" });
    await ctrl.done;
    expect(document.querySelector("p")?.textContent).toBe("Hello mundo");

    ctrl.restore();
    expect(document.querySelector("p")?.textContent).toBe(original);
    expect(ctrl.isTranslated()).toBe(false);
  });

  it("accepts a custom roots selector", async () => {
    const { calls } = installFakeTranslator();
    document.body.innerHTML =
      '<section class="translate-me"><p>foo</p></section>' +
      "<section><p>bar</p></section>";

    const ctrl = translate({
      sourceLanguage: "pt",
      targetLanguage: "en",
      roots: ".translate-me",
    });
    await ctrl.done;
    expect(calls).toEqual(["foo"]);
  });

  it("accepts roots as an Element", async () => {
    const { calls } = installFakeTranslator();
    document.body.innerHTML =
      '<section id="a"><p>foo</p></section>' +
      '<section id="b"><p>bar</p></section>';

    const root = document.getElementById("a");
    if (!root) throw new Error("root not found");
    const ctrl = translate({
      sourceLanguage: "pt",
      targetLanguage: "en",
      roots: root,
    });
    await ctrl.done;
    expect(calls).toEqual(["foo"]);
  });

  it("cancel() rejects the in-flight promise with AbortError", async () => {
    let releaseFirst: ((v: string) => void) | null = null;
    installFakeTranslator(
      (text) =>
        new Promise((resolve) => {
          if (!releaseFirst) {
            releaseFirst = resolve;
          } else {
            resolve(text);
          }
        }),
    );
    document.body.innerHTML =
      "<article data-translate-root><p>a</p><p>b</p></article>";

    const ctrl = translate({ sourceLanguage: "pt", targetLanguage: "en" });
    await Promise.resolve();
    await Promise.resolve();
    ctrl.cancel();
    if (releaseFirst) (releaseFirst as (v: string) => void)("a");

    await expect(ctrl.done).rejects.toMatchObject({ name: "AbortError" });
  });
});
