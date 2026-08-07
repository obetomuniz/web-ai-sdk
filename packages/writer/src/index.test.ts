import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearSessionCacheForTests } from "./api.js";
import {
  isAvailable,
  type WriteCache,
  WriterUnavailableError,
  write,
} from "./index.js";

interface FakeApi {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

const installFakeWriter = (
  opts: {
    output?: string;
    chunks?: string[];
    availability?: "available" | "unavailable";
  } = {},
): FakeApi => {
  const output = opts.output ?? "Generated.";
  const chunks = opts.chunks;
  const availability = opts.availability ?? "available";

  const writer = chunks
    ? {
        write: vi.fn(async () => output),
        writeStreaming: async function* (_input: string) {
          for (const c of chunks) yield c;
        },
      }
    : {
        write: vi.fn(async () => output),
      };

  const api: FakeApi = {
    availability: vi.fn(async () => availability),
    create: vi.fn(async () => writer),
  };
  (globalThis as { Writer?: FakeApi }).Writer = api;
  return api;
};

const removeFakeWriter = () => {
  (globalThis as { Writer?: unknown }).Writer = undefined;
};

const inMemoryCache = (): WriteCache => {
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
  removeFakeWriter();
});

describe("isAvailable", () => {
  it("is false when the global is missing", () => {
    expect(isAvailable()).toBe(false);
  });

  it("is true when the global is present", () => {
    installFakeWriter();
    expect(isAvailable()).toBe(true);
  });
});

describe("write", () => {
  it("throws WriterUnavailableError when the global is missing", async () => {
    await expect(write({ input: "Draft an email." })).rejects.toBeInstanceOf(
      WriterUnavailableError,
    );
  });

  it("returns a one-shot result when streaming is unavailable", async () => {
    installFakeWriter({ output: "Dear team, ..." });
    const result = await write({
      input: "Draft an email to the team.",
      cache: inMemoryCache(),
    });
    expect(result).toEqual({ output: "Dear team, ...", cached: false });
  });

  it("streams delta chunks and returns the trimmed final text", async () => {
    installFakeWriter({ chunks: ["Hello", " world", " "] });
    const chunks: string[] = [];
    const result = await write({
      input: "Say hi.",
      cache: inMemoryCache(),
      onUpdate: (c) => chunks.push(c),
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(result.output).toBe("Hello world");
    expect(result.cached).toBe(false);
  });

  it("handles cumulative chunks without double-concatenation", async () => {
    installFakeWriter({ chunks: ["Hello", "Hello world", "Hello world "] });
    const result = await write({
      input: "Say hi.",
      cache: inMemoryCache(),
    });
    expect(result.output).toBe("Hello world");
  });

  it("preserves internal markdown whitespace / line breaks", async () => {
    installFakeWriter({ output: "# Title\n\nA paragraph.\n" });
    const result = await write({
      input: "Write a post.",
      cache: inMemoryCache(),
    });
    expect(result.output).toBe("# Title\n\nA paragraph.");
  });

  it("does not cache by default", async () => {
    const api = installFakeWriter({ output: "Fresh." });
    await write({ input: "Same task." });
    await write({ input: "Same task." });
    expect(api.create).toHaveBeenCalled();
  });

  it("returns a cached value without invoking the model", async () => {
    const api = installFakeWriter();
    const cache = inMemoryCache();
    cache.set("k", "From cache.");
    const result = await write({
      input: "irrelevant",
      cache,
      cacheKey: "k",
    });
    expect(result).toEqual({ output: "From cache.", cached: true });
    expect(api.create).not.toHaveBeenCalled();
  });

  it("bypasses the cache read and replaces the value on cacheRefresh", async () => {
    const api = installFakeWriter({ output: "Fresh draft." });
    const cache = inMemoryCache();
    cache.set("k", "Stale draft.");
    const result = await write({
      input: "Draft an email.",
      cache,
      cacheKey: "k",
      cacheRefresh: true,
    });
    expect(result).toEqual({ output: "Fresh draft.", cached: false });
    expect(api.create).toHaveBeenCalled();
    expect(cache.get("k")).toBe("Fresh draft.");
  });

  it("does not overwrite a cached value when the run is aborted", async () => {
    installFakeWriter();
    const cache = inMemoryCache();
    cache.set("k", "Stale draft.");
    const controller = new AbortController();
    controller.abort();
    await expect(
      write({
        input: "Draft an email.",
        cache,
        cacheKey: "k",
        cacheRefresh: true,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(cache.get("k")).toBe("Stale draft.");
  });

  it("does not overwrite a cached value when the response is empty", async () => {
    installFakeWriter({ output: "   " });
    const cache = inMemoryCache();
    cache.set("k", "Stale draft.");
    const result = await write({
      input: "Draft an email.",
      cache,
      cacheKey: "k",
      cacheRefresh: true,
    });
    expect(result).toEqual({ output: null, cached: false });
    expect(cache.get("k")).toBe("Stale draft.");
  });

  it("does not collide cache entries when sharedContext differs", async () => {
    let calls = 0;
    const api = installFakeWriter();
    api.create.mockImplementation(async () => ({
      write: vi.fn(async () => `Draft ${++calls}.`),
    }));
    const cache = inMemoryCache();

    const first = await write({
      input: "Draft an email.",
      sharedContext: "For customers.",
      cache,
    });
    const second = await write({
      input: "Draft an email.",
      sharedContext: "For investors.",
      cache,
    });

    expect(first).toEqual({ output: "Draft 1.", cached: false });
    expect(second).toEqual({ output: "Draft 2.", cached: false });
  });

  it("does not collide cache entries when supportedLanguages changes language hints", async () => {
    let calls = 0;
    const api = installFakeWriter();
    api.create.mockImplementation(async () => ({
      write: vi.fn(async () => `Draft ${++calls}.`),
    }));
    const cache = inMemoryCache();

    const first = await write({
      input: "Draft an email.",
      language: "pt-BR",
      supportedLanguages: ["pt"],
      cache,
    });
    const second = await write({
      input: "Draft an email.",
      language: "pt-BR",
      supportedLanguages: ["en"],
      cache,
    });

    expect(first).toEqual({ output: "Draft 1.", cached: false });
    expect(second).toEqual({ output: "Draft 2.", cached: false });
  });

  it("does not fragment cache entries for unsupported language hint lists", async () => {
    let calls = 0;
    const api = installFakeWriter();
    api.create.mockImplementation(async () => ({
      write: vi.fn(async () => `Draft ${++calls}.`),
    }));
    const cache = inMemoryCache();

    const first = await write({
      input: "Draft an email.",
      language: "pt-BR",
      supportedLanguages: ["en"],
      cache,
    });
    const second = await write({
      input: "Draft an email.",
      language: "pt-BR",
      supportedLanguages: ["ja"],
      cache,
    });

    expect(first).toEqual({ output: "Draft 1.", cached: false });
    expect(second).toEqual({ output: "Draft 1.", cached: true });
  });

  it("forwards per-call context to the underlying write()", async () => {
    const api = installFakeWriter({ output: "ok" });
    await write({
      input: "Inquiry about wire transfers.",
      context: "I'm a longstanding customer.",
    });
    const instance = await api.create.mock.results[0]?.value;
    expect(instance.write).toHaveBeenCalledWith(
      "Inquiry about wire transfers.",
      expect.objectContaining({ context: "I'm a longstanding customer." }),
    );
  });

  it("throws WriterUnavailableError when availability is 'unavailable'", async () => {
    installFakeWriter({ availability: "unavailable" });
    await expect(
      write({ input: "task", cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(WriterUnavailableError);
  });

  it("does not create a session when availability is 'unavailable'", async () => {
    const api = installFakeWriter({ availability: "unavailable" });
    api.create.mockRejectedValue(new Error("create should not be called"));

    await expect(
      write({ input: "task", cache: inMemoryCache() }),
    ).rejects.toBeInstanceOf(WriterUnavailableError);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("omits language hints for unsupported languages", async () => {
    const api = installFakeWriter({ output: "ok" });
    await write({ input: "task", language: "pt", cache: inMemoryCache() });
    const createOpts = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createOpts).not.toHaveProperty("expectedInputLanguages");
    expect(createOpts).not.toHaveProperty("outputLanguage");
  });

  it("includes language hints for supported languages", async () => {
    const api = installFakeWriter({ output: "ok" });
    await write({ input: "task", language: "en", cache: inMemoryCache() });
    const createOpts = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createOpts.expectedInputLanguages).toEqual(["en"]);
    expect(createOpts.outputLanguage).toBe("en");
  });

  it("returns null output when input is empty", async () => {
    installFakeWriter();
    const result = await write({ input: "", cache: inMemoryCache() });
    expect(result).toEqual({ output: null, cached: false });
  });

  it("forwards tone/format/length to create()", async () => {
    const api = installFakeWriter({ output: "ok" });
    await write({
      input: "task",
      tone: "casual",
      format: "plain-text",
      length: "long",
    });
    const createOpts = api.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createOpts.tone).toBe("casual");
    expect(createOpts.format).toBe("plain-text");
    expect(createOpts.length).toBe("long");
  });

  it("respects an aborted signal", async () => {
    installFakeWriter({ output: "..." });
    const controller = new AbortController();
    controller.abort();
    await expect(
      write({
        input: "task",
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
      const api = installFakeWriter({ output: "Stored." });
      const first = await write({
        input: "task",
        cache: "session",
        cacheKey: "k",
      });
      expect(first).toEqual({ output: "Stored.", cached: false });
      const stored = JSON.parse(store.get("writer:k") ?? "");
      expect(stored.v).toBe(1);
      expect(stored.value).toBe("Stored.");
      expect(stored.expiresAt).toBeGreaterThan(Date.now());

      const createsAfterFirst = api.create.mock.calls.length;
      const second = await write({
        input: "task",
        cache: "session",
        cacheKey: "k",
      });
      expect(second).toEqual({ output: "Stored.", cached: true });
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
      const api = installFakeWriter({ output: "Stored." });
      const first = await write({
        input: "task",
        cache: "local",
        cacheKey: "k",
      });
      expect(first).toEqual({ output: "Stored.", cached: false });
      const stored = JSON.parse(store.get("writer:k") ?? "");
      expect(stored.v).toBe(1);
      expect(stored.value).toBe("Stored.");
      expect(stored.expiresAt).toBeGreaterThan(Date.now());

      const createsAfterFirst = api.create.mock.calls.length;
      const second = await write({
        input: "task",
        cache: "local",
        cacheKey: "k",
      });
      expect(second).toEqual({ output: "Stored.", cached: true });
      expect(api.create).toHaveBeenCalledTimes(createsAfterFirst);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("aborts without writing the cache", async () => {
    installFakeWriter({ output: "..." });
    const cache = { get: vi.fn(() => null), set: vi.fn() };
    const controller = new AbortController();
    controller.abort();
    await expect(
      write({ input: "task", cache, signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(cache.set).not.toHaveBeenCalled();
  });
});
