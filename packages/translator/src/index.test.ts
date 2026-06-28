import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  clearTranslatorSession,
  clearTranslatorSessions,
  configureTranslatorCache,
  isAvailable,
  type TranslationCache,
  TranslatorUnavailableError,
  translate,
} from "./index.js";

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
  opts: { availability?: "available" | "unavailable" } = {},
) => {
  const calls: string[] = [];
  const sessions: Array<{
    translate: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];
  const impl = translateImpl ?? (async (text: string) => `[t]${text}`);
  const availability = opts.availability ?? "available";

  const api = {
    availability: vi.fn(async () => availability),
    create: vi.fn(async (_options: CreateOptions) => {
      const session = {
        translate: vi.fn(async (text: string) => {
          calls.push(text);
          return impl(text);
        }),
        destroy: vi.fn(),
      };
      sessions.push(session);
      return session;
    }),
  };
  (globalThis as { Translator?: typeof api }).Translator = api;
  return { api, calls, sessions };
};

const removeFakeTranslator = () => {
  (globalThis as { Translator?: unknown }).Translator = undefined;
};

const inMemoryCache = (): TranslationCache => {
  const store = new Map<string, string>();
  return {
    get: (k) => store.get(k) ?? null,
    set: (k, v) => {
      store.set(k, v);
    },
  };
};

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  removeFakeTranslator();
});

describe("isAvailable", () => {
  it("is false when the global is missing", () => {
    expect(isAvailable()).toBe(false);
  });

  it("is true when the global is present", () => {
    installFakeTranslator();
    expect(isAvailable()).toBe(true);
  });
});

describe("translate", () => {
  it("throws TranslatorUnavailableError when the global is missing", async () => {
    await expect(
      translate({ input: "Hello", sourceLanguage: "en", targetLanguage: "pt" }),
    ).rejects.toBeInstanceOf(TranslatorUnavailableError);
  });

  it("returns null output when source and target languages match", async () => {
    installFakeTranslator();
    const result = await translate({
      input: "Hello",
      sourceLanguage: "en",
      targetLanguage: "en",
    });
    expect(result).toEqual({ output: null, cached: false });
  });

  it("returns null output when input is empty", async () => {
    installFakeTranslator();
    const result = await translate({
      input: "  ",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    expect(result).toEqual({ output: null, cached: false });
  });

  it("translates a string and returns the model's output", async () => {
    installFakeTranslator(async (text) => text.replace("Olá", "Hello"));
    const result = await translate({
      input: "Olá mundo",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    expect(result.output).toBe("Hello mundo");
    expect(result.cached).toBe(false);
  });

  it("normalizes regional language tags (e.g. pt-BR → pt)", async () => {
    const { api } = installFakeTranslator();
    await translate({
      input: "Olá",
      sourceLanguage: "pt-BR",
      targetLanguage: "en-US",
    });
    const createArgs = api.create.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    expect(createArgs.sourceLanguage).toBe("pt");
    expect(createArgs.targetLanguage).toBe("en");
  });

  it("does not cache by default; same call hits the model twice without a `cache` option", async () => {
    const { api } = installFakeTranslator();
    await translate({
      input: "Olá",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await translate({
      input: "Olá",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    // Same session is reused; we just check the inner translate was called twice.
    const session = await api.create.mock.results[0]?.value;
    expect(session.translate).toHaveBeenCalledTimes(2);
  });

  it("returns a cached value without invoking the model", async () => {
    const { api } = installFakeTranslator();
    const cache = inMemoryCache();
    cache.set("k", "From cache.");
    const result = await translate({
      input: "irrelevant",
      sourceLanguage: "pt",
      targetLanguage: "en",
      cache,
      cacheKey: "k",
    });
    expect(result).toEqual({ output: "From cache.", cached: true });
    expect(api.create).not.toHaveBeenCalled();
  });

  it("writes successful translations to the cache", async () => {
    installFakeTranslator(async () => "Hello");
    const cache = inMemoryCache();
    await translate({
      input: "Olá",
      sourceLanguage: "pt",
      targetLanguage: "en",
      cache,
      cacheKey: "k",
    });
    expect(cache.get("k")).toBe("Hello");
  });

  it("reuses sessions across same-pair calls", async () => {
    const { api } = installFakeTranslator();
    await translate({
      input: "a",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await translate({
      input: "b",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it("caps different language pairs and evicts the oldest session", async () => {
    const { api, sessions } = installFakeTranslator();
    configureTranslatorCache({ max: 1 });
    await translate({
      input: "a",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await translate({
      input: "b",
      sourceLanguage: "es",
      targetLanguage: "en",
    });

    expect(api.create).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(sessions[0]?.destroy).toHaveBeenCalled());
  });

  it("bumps cache hit recency before evicting", async () => {
    const { sessions } = installFakeTranslator();
    configureTranslatorCache({ max: 2 });
    await translate({
      input: "a",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await translate({
      input: "b",
      sourceLanguage: "es",
      targetLanguage: "en",
    });
    await translate({
      input: "c",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await translate({
      input: "d",
      sourceLanguage: "fr",
      targetLanguage: "en",
    });

    await vi.waitFor(() => expect(sessions[1]?.destroy).toHaveBeenCalled());
    expect(sessions[0]?.destroy).not.toHaveBeenCalled();
  });

  it("lowering max evicts the oldest session", async () => {
    const { sessions } = installFakeTranslator();
    await translate({
      input: "a",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await translate({
      input: "b",
      sourceLanguage: "es",
      targetLanguage: "en",
    });

    configureTranslatorCache({ max: 1 });

    await vi.waitFor(() => expect(sessions[0]?.destroy).toHaveBeenCalled());
    expect(sessions[1]?.destroy).not.toHaveBeenCalled();
  });

  it("treats non-finite max values as zero", async () => {
    const { sessions } = installFakeTranslator();
    await translate({
      input: "a",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });

    configureTranslatorCache({ max: Number.NaN });

    await vi.waitFor(() => expect(sessions[0]?.destroy).toHaveBeenCalled());
  });

  it("clears all translator sessions", async () => {
    const { sessions } = installFakeTranslator();
    await translate({
      input: "a",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await translate({
      input: "b",
      sourceLanguage: "es",
      targetLanguage: "en",
    });

    clearTranslatorSessions();

    await vi.waitFor(() => expect(sessions[0]?.destroy).toHaveBeenCalled());
    expect(sessions[1]?.destroy).toHaveBeenCalled();
  });

  it("clears one matching translator session", async () => {
    const { sessions } = installFakeTranslator();
    await translate({
      input: "a",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await translate({
      input: "b",
      sourceLanguage: "es",
      targetLanguage: "en",
    });

    clearTranslatorSession({ sourceLanguage: "pt", targetLanguage: "en" });

    await vi.waitFor(() => expect(sessions[0]?.destroy).toHaveBeenCalled());
    expect(sessions[1]?.destroy).not.toHaveBeenCalled();
  });

  it("clears translator sessions when passed regional language tags", async () => {
    const { sessions } = installFakeTranslator();
    await translate({
      input: "a",
      sourceLanguage: "pt-BR",
      targetLanguage: "en-US",
    });

    clearTranslatorSession({
      sourceLanguage: "pt-BR",
      targetLanguage: "en-US",
    });

    await vi.waitFor(() => expect(sessions[0]?.destroy).toHaveBeenCalled());
  });

  it("test cache reset restores the default max", async () => {
    const { sessions } = installFakeTranslator();
    configureTranslatorCache({ max: 1 });
    __clearSessionCacheForTests();
    await translate({
      input: "a",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await translate({
      input: "b",
      sourceLanguage: "es",
      targetLanguage: "en",
    });

    expect(sessions[0]?.destroy).not.toHaveBeenCalled();
  });

  it("creates a new session when the language pair differs", async () => {
    const { api } = installFakeTranslator();
    await translate({
      input: "a",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await translate({
      input: "b",
      sourceLanguage: "es",
      targetLanguage: "en",
    });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("throws TranslatorUnavailableError when availability is 'unavailable'", async () => {
    installFakeTranslator(undefined, { availability: "unavailable" });
    await expect(
      translate({ input: "Olá", sourceLanguage: "pt", targetLanguage: "en" }),
    ).rejects.toBeInstanceOf(TranslatorUnavailableError);
  });

  it("does not create a session when availability is 'unavailable'", async () => {
    const { api } = installFakeTranslator(undefined, {
      availability: "unavailable",
    });
    api.create.mockRejectedValue(new Error("create should not be called"));

    await expect(
      translate({ input: "Olá", sourceLanguage: "pt", targetLanguage: "en" }),
    ).rejects.toBeInstanceOf(TranslatorUnavailableError);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("purges rejected session creates so the next call retries", async () => {
    const { api } = installFakeTranslator();
    api.create
      .mockRejectedValueOnce(new Error("create failed"))
      .mockResolvedValueOnce({
        translate: vi.fn(async (text: string) => `[retry]${text}`),
        destroy: vi.fn(),
      });

    await expect(
      translate({ input: "Olá", sourceLanguage: "pt", targetLanguage: "en" }),
    ).rejects.toBeInstanceOf(TranslatorUnavailableError);
    await translate({
      input: "Olá",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });

    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("respects an aborted signal", async () => {
    installFakeTranslator();
    const controller = new AbortController();
    controller.abort();
    await expect(
      translate({
        input: "Olá",
        sourceLanguage: "pt",
        targetLanguage: "en",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("defaults targetLanguage to 'en' when omitted", async () => {
    const { api } = installFakeTranslator();
    await translate({ input: "Olá", sourceLanguage: "pt" });
    const createArgs = api.create.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    expect(createArgs.targetLanguage).toBe("en");
  });

  it('honors cache: "session" via sessionStorage', async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: vi.fn((k: string) => store.get(k) ?? null),
      setItem: vi.fn((k: string, v: string) => {
        store.set(k, v);
      }),
    };
    vi.stubGlobal("sessionStorage", storage);
    try {
      const { api } = installFakeTranslator();
      const first = await translate({
        input: "Olá",
        sourceLanguage: "pt",
        targetLanguage: "en",
        cache: "session",
        cacheKey: "k",
      });
      expect(first).toEqual({ output: "[t]Olá", cached: false });
      expect(storage.setItem).toHaveBeenCalledWith("translator:k", "[t]Olá");

      const createsAfterFirst = api.create.mock.calls.length;
      const second = await translate({
        input: "Olá",
        sourceLanguage: "pt",
        targetLanguage: "en",
        cache: "session",
        cacheKey: "k",
      });
      expect(second).toEqual({ output: "[t]Olá", cached: true });
      expect(api.create).toHaveBeenCalledTimes(createsAfterFirst);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('honors cache: "local" via localStorage', async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: vi.fn((k: string) => store.get(k) ?? null),
      setItem: vi.fn((k: string, v: string) => {
        store.set(k, v);
      }),
    };
    vi.stubGlobal("localStorage", storage);
    try {
      const { api } = installFakeTranslator();
      const first = await translate({
        input: "Olá",
        sourceLanguage: "pt",
        targetLanguage: "en",
        cache: "local",
        cacheKey: "k",
      });
      expect(first).toEqual({ output: "[t]Olá", cached: false });
      expect(storage.setItem).toHaveBeenCalledWith("translator:k", "[t]Olá");

      const createsAfterFirst = api.create.mock.calls.length;
      const second = await translate({
        input: "Olá",
        sourceLanguage: "pt",
        targetLanguage: "en",
        cache: "local",
        cacheKey: "k",
      });
      expect(second).toEqual({ output: "[t]Olá", cached: true });
      expect(api.create).toHaveBeenCalledTimes(createsAfterFirst);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("aborts without writing the cache", async () => {
    installFakeTranslator();
    const cache = { get: vi.fn(() => null), set: vi.fn() };
    const controller = new AbortController();
    controller.abort();
    await expect(
      translate({
        input: "Olá",
        sourceLanguage: "pt",
        targetLanguage: "en",
        cache,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(cache.set).not.toHaveBeenCalled();
  });
});
