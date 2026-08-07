import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CACHE_TTL_MS, resolveCache } from "./cache.js";

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

const installSessionStorage = (storage: Storage | undefined): void => {
  Object.defineProperty(globalThis, "sessionStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
};

let originalSessionStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  originalSessionStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  if (originalSessionStorage) {
    Object.defineProperty(globalThis, "sessionStorage", originalSessionStorage);
  } else {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  }
});

describe("storage shortcut TTL envelope", () => {
  it("round-trips a value through a versioned envelope", () => {
    const storage = fakeStorage();
    installSessionStorage(storage);
    const cache = resolveCache("session");
    cache?.set("k", "v");
    expect(cache?.get("k")).toBe("v");
    const raw = storage.getItem("detector:k");
    expect(raw).not.toBe("v");
    expect(JSON.parse(raw ?? "")).toEqual({
      v: 1,
      value: "v",
      expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
    });
  });

  it("expires entries after the default TTL and removes them", () => {
    const storage = fakeStorage();
    installSessionStorage(storage);
    const cache = resolveCache("session");
    cache?.set("k", "v");
    vi.advanceTimersByTime(DEFAULT_CACHE_TTL_MS - 1);
    expect(cache?.get("k")).toBe("v");
    vi.advanceTimersByTime(1);
    expect(cache?.get("k")).toBeNull();
    expect(storage.getItem("detector:k")).toBeNull();
  });

  it("honors a caller-provided TTL override", () => {
    installSessionStorage(fakeStorage());
    const cache = resolveCache("session", 5_000);
    cache?.set("k", "v");
    vi.advanceTimersByTime(4_999);
    expect(cache?.get("k")).toBe("v");
    vi.advanceTimersByTime(1);
    expect(cache?.get("k")).toBeNull();
  });

  it("falls back to the default TTL for invalid overrides", () => {
    installSessionStorage(fakeStorage());
    for (const ttl of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const cache = resolveCache("session", ttl);
      cache?.set("k", "v");
      expect(cache?.get("k")).toBe("v");
      vi.advanceTimersByTime(DEFAULT_CACHE_TTL_MS);
      expect(cache?.get("k")).toBeNull();
    }
  });

  it("treats legacy raw strings as misses and removes them", () => {
    const storage = fakeStorage();
    installSessionStorage(storage);
    storage.setItem("detector:k", "legacy value");
    const cache = resolveCache("session");
    expect(cache?.get("k")).toBeNull();
    expect(storage.getItem("detector:k")).toBeNull();
  });

  it("treats malformed envelopes as misses", () => {
    const storage = fakeStorage();
    installSessionStorage(storage);
    const cache = resolveCache("session");
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
      storage.setItem("detector:k", entry);
      expect(cache?.get("k")).toBeNull();
      expect(storage.getItem("detector:k")).toBeNull();
    }
  });

  it("replaces an invalid entry on the next set", () => {
    const storage = fakeStorage();
    installSessionStorage(storage);
    storage.setItem("detector:k", "legacy value");
    const cache = resolveCache("session");
    expect(cache?.get("k")).toBeNull();
    cache?.set("k", "fresh");
    expect(cache?.get("k")).toBe("fresh");
  });

  it("returns null when storage is missing", () => {
    installSessionStorage(undefined);
    const cache = resolveCache("session");
    expect(cache?.get("k")).toBeNull();
    expect(() => cache?.set("k", "v")).not.toThrow();
  });

  it("swallows storage failures on get, set, and cleanup", () => {
    const storage = fakeStorage();
    storage.setItem("detector:k", "legacy value");
    const throwing = {
      ...storage,
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    } as Storage;
    installSessionStorage(throwing);
    const cache = resolveCache("session");
    expect(cache?.get("k")).toBeNull();
    expect(() => cache?.set("k", "v")).not.toThrow();

    const removeThrows = {
      ...storage,
      getItem: (k: string) => storage.getItem(k),
      removeItem: () => {
        throw new Error("denied");
      },
    } as Storage;
    installSessionStorage(removeThrows);
    const cleanupCache = resolveCache("session");
    expect(cleanupCache?.get("k")).toBeNull();
  });

  it("passes custom cache objects through untouched", () => {
    const custom = { get: () => "v", set: () => {} };
    expect(resolveCache(custom, 5_000)).toBe(custom);
  });
});
