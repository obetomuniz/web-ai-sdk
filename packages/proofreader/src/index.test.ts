import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  isAvailable,
  type ProofreadCache,
  ProofreaderUnavailableError,
  proofread,
} from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  proofreadSpy: ReturnType<typeof vi.fn>;
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
  const session = { proofread: proofreadSpy };
  const api: FakeApi = {
    availability: vi.fn(async () => opts.availability ?? "available"),
    create: vi.fn(async () => session),
    proofreadSpy,
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
});
