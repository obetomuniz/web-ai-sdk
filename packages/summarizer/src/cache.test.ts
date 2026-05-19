import { describe, expect, it } from "vitest";
import { createSessionStorageCache, defaultCacheKey } from "./cache.js";

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

describe("createSessionStorageCache", () => {
  it("round-trips a value through the storage backend", () => {
    const storage = fakeStorage();
    const cache = createSessionStorageCache({ storage });
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
    expect(storage.getItem("summarizer:k")).toBe("v");
  });

  it("returns null when storage is missing", () => {
    const cache = createSessionStorageCache({
      storage: undefined as unknown as Storage,
    });
    expect(cache.get("k")).toBeNull();
    expect(() => cache.set("k", "v")).not.toThrow();
  });

  it("supports a custom prefix", () => {
    const storage = fakeStorage();
    const cache = createSessionStorageCache({ storage, prefix: "p:" });
    cache.set("k", "v");
    expect(storage.getItem("p:k")).toBe("v");
  });

  it("swallows errors from the underlying storage on get", () => {
    const cache = createSessionStorageCache({
      storage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      } as Storage,
    });
    expect(cache.get("k")).toBeNull();
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
