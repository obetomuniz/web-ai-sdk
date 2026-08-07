import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSessionStorageCache,
  DEFAULT_CACHE_TTL_MS,
  defaultCacheKey,
  resolveCache,
} from "./cache.js";

const fakeStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, v);
    },
  };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createSessionStorageCache TTL envelope", () => {
  it("round-trips a value through a versioned envelope", () => {
    const storage = fakeStorage();
    const cache = createSessionStorageCache({ storage });
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
    const raw = storage.getItem("summarizer:k");
    expect(raw).not.toBe("v");
    expect(JSON.parse(raw ?? "")).toEqual({
      v: 1,
      value: "v",
      expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
    });
  });

  it("expires entries after the default TTL and removes them", () => {
    const storage = fakeStorage();
    const cache = createSessionStorageCache({ storage });
    cache.set("k", "v");
    vi.advanceTimersByTime(DEFAULT_CACHE_TTL_MS - 1);
    expect(cache.get("k")).toBe("v");
    vi.advanceTimersByTime(1);
    expect(cache.get("k")).toBeNull();
    expect(storage.getItem("summarizer:k")).toBeNull();
  });

  it("honors a caller-provided TTL override", () => {
    const cache = createSessionStorageCache({
      storage: fakeStorage(),
      ttlMs: 5_000,
    });
    cache.set("k", "v");
    vi.advanceTimersByTime(4_999);
    expect(cache.get("k")).toBe("v");
    vi.advanceTimersByTime(1);
    expect(cache.get("k")).toBeNull();
  });

  it("falls back to the default TTL for invalid overrides", () => {
    for (const ttl of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const cache = createSessionStorageCache({
        storage: fakeStorage(),
        ttlMs: ttl,
      });
      cache.set("k", "v");
      expect(cache.get("k")).toBe("v");
      vi.advanceTimersByTime(DEFAULT_CACHE_TTL_MS);
      expect(cache.get("k")).toBeNull();
    }
  });

  it("treats legacy raw strings as misses and removes them", () => {
    const storage = fakeStorage();
    storage.setItem("summarizer:k", "legacy value");
    const cache = createSessionStorageCache({ storage });
    expect(cache.get("k")).toBeNull();
    expect(storage.getItem("summarizer:k")).toBeNull();
  });

  it("treats malformed envelopes as misses", () => {
    const storage = fakeStorage();
    const cache = createSessionStorageCache({ storage });
    const badEntries = [
      "{not json",
      "null",
      '"just a string"',
      JSON.stringify({ v: 2, value: "v", expiresAt: Date.now() + 1000 }),
      JSON.stringify({ v: 1, expiresAt: Date.now() + 1000 }),
      JSON.stringify({ v: 1, value: 42, expiresAt: Date.now() + 1000 }),
      JSON.stringify({ v: 1, value: "v" }),
      JSON.stringify({ v: 1, value: "v", expiresAt: "soon" }),
      JSON.stringify({ v: 1, value: "v", expiresAt: Number.NaN }),
    ];
    for (const entry of badEntries) {
      storage.setItem("summarizer:k", entry);
      expect(cache.get("k")).toBeNull();
      expect(storage.getItem("summarizer:k")).toBeNull();
    }
  });

  it("replaces an invalid entry on the next set", () => {
    const storage = fakeStorage();
    storage.setItem("summarizer:k", "legacy value");
    const cache = createSessionStorageCache({ storage });
    expect(cache.get("k")).toBeNull();
    cache.set("k", "fresh");
    expect(cache.get("k")).toBe("fresh");
  });

  it("supports a custom prefix", () => {
    const storage = fakeStorage();
    const cache = createSessionStorageCache({ storage, prefix: "p:" });
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
    expect(storage.getItem("p:k")).not.toBeNull();
  });

  it("returns null when storage is missing", () => {
    const cache = createSessionStorageCache({
      storage: undefined as unknown as Storage,
    });
    expect(cache.get("k")).toBeNull();
    expect(() => cache.set("k", "v")).not.toThrow();
  });

  it("swallows storage failures on get, set, and cleanup", () => {
    const storage = fakeStorage();
    storage.setItem("summarizer:k", "legacy value");
    const throwing = {
      ...storage,
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    } as Storage;
    const cache = createSessionStorageCache({ storage: throwing });
    expect(cache.get("k")).toBeNull();
    expect(() => cache.set("k", "v")).not.toThrow();

    const removeThrows = {
      ...storage,
      getItem: (k: string) => storage.getItem(k),
      removeItem: () => {
        throw new Error("denied");
      },
    } as Storage;
    const cleanupCache = createSessionStorageCache({ storage: removeThrows });
    expect(cleanupCache.get("k")).toBeNull();
  });
});

describe("resolveCache", () => {
  it("forwards the TTL override to the session storage shortcut", () => {
    const storage = fakeStorage();
    const original = Object.getOwnPropertyDescriptor(
      globalThis,
      "sessionStorage",
    );
    Object.defineProperty(globalThis, "sessionStorage", {
      value: storage,
      configurable: true,
      writable: true,
    });
    try {
      const cache = resolveCache("session", 5_000);
      cache?.set("k", "v");
      vi.advanceTimersByTime(4_999);
      expect(cache?.get("k")).toBe("v");
      vi.advanceTimersByTime(1);
      expect(cache?.get("k")).toBeNull();
    } finally {
      if (original) {
        Object.defineProperty(globalThis, "sessionStorage", original);
      } else {
        delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
      }
    }
  });

  it("passes custom cache objects through untouched", () => {
    const custom = { get: () => "v", set: () => {} };
    expect(resolveCache(custom, 5_000)).toBe(custom);
  });
});

describe("defaultCacheKey", () => {
  it("combines pathname and lang", () => {
    const original = (globalThis as { location?: Location }).location;
    Object.defineProperty(globalThis, "location", {
      value: { pathname: "/blog/post" } as Location,
      configurable: true,
    });
    try {
      expect(defaultCacheKey("en")).toBe("/blog/post:en");
    } finally {
      if (original) {
        Object.defineProperty(globalThis, "location", {
          value: original,
          configurable: true,
        });
      }
    }
  });
});
