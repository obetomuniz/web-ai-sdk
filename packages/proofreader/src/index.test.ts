import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  clearProofreaderSession,
  clearProofreaderSessions,
  configureProofreaderCache,
  isAvailable,
  type ProofreadCache,
  ProofreaderUnavailableError,
  proofread,
} from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  proofreadSpy: ReturnType<typeof vi.fn>;
  sessions: Array<{
    proofread: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }>;
}

const installFakeProofreader = (
  opts: {
    correctedInput?: string;
    corrections?: Array<{
      startIndex: number;
      endIndex: number;
      correction: string;
    }>;
    availability?: "available" | "unavailable";
  } = {},
): FakeApi => {
  const result = {
    correctedInput: opts.correctedInput ?? "Corrected.",
    corrections: opts.corrections ?? [],
  };
  const proofreadSpy = vi.fn(async () => result);
  const sessions: FakeApi["sessions"] = [];
  const api: FakeApi = {
    availability: vi.fn(async () => opts.availability ?? "available"),
    create: vi.fn(async () => {
      const session = { proofread: proofreadSpy, destroy: vi.fn() };
      sessions.push(session);
      return session;
    }),
    proofreadSpy,
    sessions,
  };
  (globalThis as { Proofreader?: unknown }).Proofreader = api;
  return api;
};

const removeFakeProofreader = () => {
  (globalThis as { Proofreader?: unknown }).Proofreader = undefined;
};

const inMemoryCache = (): ProofreadCache => {
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
  removeFakeProofreader();
});

describe("isAvailable", () => {
  it("is false when the global is missing", () => {
    expect(isAvailable()).toBe(false);
  });

  it("is true when the global is present", () => {
    installFakeProofreader();
    expect(isAvailable()).toBe(true);
  });
});

describe("proofread", () => {
  it("throws ProofreaderUnavailableError when the global is missing", async () => {
    await expect(proofread({ input: "I has cat." })).rejects.toBeInstanceOf(
      ProofreaderUnavailableError,
    );
  });

  it("returns corrected text plus corrections", async () => {
    installFakeProofreader({
      correctedInput: "I have a cat.",
      corrections: [{ startIndex: 2, endIndex: 5, correction: "have" }],
    });
    const result = await proofread({
      input: "I has cat.",
      cache: inMemoryCache(),
    });
    expect(result.cached).toBe(false);
    expect(result.output?.correctedInput).toBe("I have a cat.");
    expect(result.output?.corrections).toHaveLength(1);
  });

  it("returns null output when input is empty", async () => {
    installFakeProofreader();
    const result = await proofread({ input: "   ", cache: inMemoryCache() });
    expect(result).toEqual({ output: null, cached: false });
  });

  it("returns a cached value without invoking the model", async () => {
    const api = installFakeProofreader();
    const cache = inMemoryCache();
    cache.set(
      "k",
      JSON.stringify({ correctedInput: "From cache.", corrections: [] }),
    );
    const result = await proofread({
      input: "irrelevant",
      cache,
      cacheKey: "k",
    });
    expect(result.output?.correctedInput).toBe("From cache.");
    expect(result.cached).toBe(true);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("writes results to the cache", async () => {
    installFakeProofreader({ correctedInput: "Fixed." });
    const cache = inMemoryCache();
    await proofread({ input: "Fix me", cache, cacheKey: "k" });
    const cached = cache.get("k");
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached as string).correctedInput).toBe("Fixed.");
  });

  it("reuses sessions across same-shape calls", async () => {
    const api = installFakeProofreader();
    await proofread({ input: "a", expectedInputLanguages: ["en"] });
    await proofread({ input: "b", expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it("reuses sessions for equivalent expected language order", async () => {
    const api = installFakeProofreader();
    await proofread({ input: "a", expectedInputLanguages: ["en", "es"] });
    await proofread({ input: "b", expectedInputLanguages: ["es", "en"] });
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it("caps sessions and evicts the oldest proofreader", async () => {
    const api = installFakeProofreader();
    configureProofreaderCache({ max: 1 });
    await proofread({ input: "a", expectedInputLanguages: ["en"] });
    await proofread({ input: "b", expectedInputLanguages: ["es"] });

    expect(api.create).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(api.sessions[0]?.destroy).toHaveBeenCalled());
  });

  it("bumps proofreader cache hit recency before evicting", async () => {
    const api = installFakeProofreader();
    configureProofreaderCache({ max: 2 });
    await proofread({ input: "a", expectedInputLanguages: ["en"] });
    await proofread({ input: "b", expectedInputLanguages: ["es"] });
    await proofread({ input: "c", expectedInputLanguages: ["en"] });
    await proofread({ input: "d", expectedInputLanguages: ["fr"] });

    await vi.waitFor(() => expect(api.sessions[1]?.destroy).toHaveBeenCalled());
    expect(api.sessions[0]?.destroy).not.toHaveBeenCalled();
  });

  it("lowering max trims proofreader sessions immediately", async () => {
    const api = installFakeProofreader();
    await proofread({ input: "a", expectedInputLanguages: ["en"] });
    await proofread({ input: "b", expectedInputLanguages: ["es"] });

    configureProofreaderCache({ max: 1 });

    await vi.waitFor(() => expect(api.sessions[0]?.destroy).toHaveBeenCalled());
    expect(api.sessions[1]?.destroy).not.toHaveBeenCalled();
  });

  it("clears all proofreader sessions", async () => {
    const api = installFakeProofreader();
    await proofread({ input: "a", expectedInputLanguages: ["en"] });
    await proofread({ input: "b", expectedInputLanguages: ["es"] });

    clearProofreaderSessions();

    await vi.waitFor(() => expect(api.sessions[0]?.destroy).toHaveBeenCalled());
    expect(api.sessions[1]?.destroy).toHaveBeenCalled();
  });

  it("treats non-finite max values as zero", async () => {
    const api = installFakeProofreader();
    await proofread({ input: "a", expectedInputLanguages: ["en"] });

    configureProofreaderCache({ max: Number.NaN });

    await vi.waitFor(() => expect(api.sessions[0]?.destroy).toHaveBeenCalled());
  });

  it("clears one matching proofreader session", async () => {
    const api = installFakeProofreader();
    await proofread({ input: "a", expectedInputLanguages: ["en"] });
    await proofread({ input: "b", expectedInputLanguages: ["es"] });

    clearProofreaderSession({ expectedInputLanguages: ["en"] });

    await vi.waitFor(() => expect(api.sessions[0]?.destroy).toHaveBeenCalled());
    expect(api.sessions[1]?.destroy).not.toHaveBeenCalled();
  });

  it("clears a proofreader session with equivalent expected language order", async () => {
    const api = installFakeProofreader();
    await proofread({ input: "a", expectedInputLanguages: ["en", "es"] });

    clearProofreaderSession({ expectedInputLanguages: ["es", "en"] });

    await vi.waitFor(() => expect(api.sessions[0]?.destroy).toHaveBeenCalled());
  });

  it("test cache reset restores the proofreader default max", async () => {
    const api = installFakeProofreader();
    configureProofreaderCache({ max: 1 });
    __clearSessionCacheForTests();
    await proofread({ input: "a", expectedInputLanguages: ["en"] });
    await proofread({ input: "b", expectedInputLanguages: ["es"] });

    expect(api.sessions[0]?.destroy).not.toHaveBeenCalled();
  });

  it("throws ProofreaderUnavailableError when availability is 'unavailable'", async () => {
    installFakeProofreader({ availability: "unavailable" });
    await expect(
      proofread({ input: "text", cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(ProofreaderUnavailableError);
  });

  it("does not create a session when availability is 'unavailable'", async () => {
    const api = installFakeProofreader({ availability: "unavailable" });
    api.create.mockRejectedValue(new Error("create should not be called"));

    await expect(
      proofread({ input: "text", cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(ProofreaderUnavailableError);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("purges rejected session creates so the next call retries", async () => {
    const api = installFakeProofreader();
    api.create
      .mockRejectedValueOnce(new Error("create failed"))
      .mockResolvedValueOnce({
        proofread: vi.fn(async () => ({
          correctedInput: "Retried.",
          corrections: [],
        })),
        destroy: vi.fn(),
      });

    await expect(proofread({ input: "text" })).rejects.toBeInstanceOf(
      ProofreaderUnavailableError,
    );
    await proofread({ input: "text" });

    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("passes expectedInputLanguages through to create()", async () => {
    const api = installFakeProofreader();
    await proofread({
      input: "text",
      expectedInputLanguages: ["en"],
      cache: inMemoryCache(),
    });
    const createOpts = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createOpts.expectedInputLanguages).toEqual(["en"]);
  });

  it("respects an aborted signal", async () => {
    installFakeProofreader();
    const controller = new AbortController();
    controller.abort();
    await expect(
      proofread({
        input: "text",
        cache: inMemoryCache(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
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
      const api = installFakeProofreader({ correctedInput: "Fixed." });
      const first = await proofread({
        input: "text",
        cache: "session",
        cacheKey: "k",
      });
      expect(first.cached).toBe(false);
      expect(first.output?.correctedInput).toBe("Fixed.");
      expect(storage.setItem).toHaveBeenCalledWith(
        "proofreader:k",
        '{"correctedInput":"Fixed.","corrections":[]}',
      );

      const createsAfterFirst = api.create.mock.calls.length;
      const second = await proofread({
        input: "text",
        cache: "session",
        cacheKey: "k",
      });
      expect(second.output?.correctedInput).toBe("Fixed.");
      expect(second.cached).toBe(true);
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
      const api = installFakeProofreader({ correctedInput: "Fixed." });
      const first = await proofread({
        input: "text",
        cache: "local",
        cacheKey: "k",
      });
      expect(first.cached).toBe(false);
      expect(first.output?.correctedInput).toBe("Fixed.");
      expect(storage.setItem).toHaveBeenCalledWith(
        "proofreader:k",
        '{"correctedInput":"Fixed.","corrections":[]}',
      );

      const createsAfterFirst = api.create.mock.calls.length;
      const second = await proofread({
        input: "text",
        cache: "local",
        cacheKey: "k",
      });
      expect(second.output?.correctedInput).toBe("Fixed.");
      expect(second.cached).toBe(true);
      expect(api.create).toHaveBeenCalledTimes(createsAfterFirst);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("aborts without writing the cache", async () => {
    installFakeProofreader();
    const cache = { get: vi.fn(() => null), set: vi.fn() };
    const controller = new AbortController();
    controller.abort();
    await expect(
      proofread({ input: "text", cache, signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(cache.set).not.toHaveBeenCalled();
  });
});
