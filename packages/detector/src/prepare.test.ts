import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearSessionCacheForTests,
  configureLanguageDetectorCache,
} from "./api.js";
import {
  clearLanguageDetectorSessions,
  DetectorUnavailableError,
  detect,
  prepareLanguageDetector,
} from "./index.js";

interface FakeDetector {
  detect: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const RESULTS = [
  { detectedLanguage: "en", confidence: 0.95 },
  { detectedLanguage: "es", confidence: 0.04 },
];

const makeInstance = (): FakeDetector => ({
  detect: vi.fn(async () => RESULTS),
  destroy: vi.fn(),
});

const installFakeApi = () => {
  const instances: FakeDetector[] = [];
  const api = {
    availability: vi.fn(async () => "available" as const),
    create: vi.fn(async () => {
      const instance = makeInstance();
      instances.push(instance);
      return instance;
    }),
  };
  (globalThis as { LanguageDetector?: unknown }).LanguageDetector = api;
  return { api, instances };
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  (globalThis as { LanguageDetector?: unknown }).LanguageDetector = undefined;
});

describe("prepareLanguageDetector", () => {
  it("starts creation immediately and the matching detect reuses it", async () => {
    const { api } = installFakeApi();
    const lease = prepareLanguageDetector({ expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(1);
    await lease.ready;

    const result = await detect({
      input: "hello",
      expectedInputLanguages: ["en"],
    });
    expect(result.output?.language).toBe("en");
    expect(api.create).toHaveBeenCalledTimes(1);
    lease.release();
  });

  it("never throws when the API is missing; ready rejects instead", async () => {
    const lease = prepareLanguageDetector({ expectedInputLanguages: ["en"] });
    await expect(lease.ready).rejects.toBeInstanceOf(DetectorUnavailableError);
    expect(() => lease.release()).not.toThrow();
  });

  it("shares one session between concurrent leases and destroys exactly once", async () => {
    const { api, instances } = installFakeApi();
    const first = prepareLanguageDetector({ expectedInputLanguages: ["en"] });
    const second = prepareLanguageDetector({ expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(1);
    await Promise.all([first.ready, second.ready]);

    first.release();
    first.release();
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();

    second.release();
    second.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("release before creation settles destroys the session once created", async () => {
    const { api } = installFakeApi();
    let resolveCreate: (instance: FakeDetector) => void = () => {};
    const instance = makeInstance();
    api.create.mockImplementationOnce(
      () =>
        new Promise<FakeDetector>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const lease = prepareLanguageDetector({ expectedInputLanguages: ["en"] });
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveCreate(instance);
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);

    // The released entry left the cache, so preparing again creates anew.
    const retry = prepareLanguageDetector({ expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(2);
    await retry.ready;
    retry.release();
  });

  it("creation failure rejects ready, evicts the entry, and allows retry", async () => {
    const { api } = installFakeApi();
    api.create.mockRejectedValueOnce(new Error("no space"));

    const failed = prepareLanguageDetector({ expectedInputLanguages: ["en"] });
    await expect(failed.ready).rejects.toBeInstanceOf(DetectorUnavailableError);
    failed.release();

    const retry = prepareLanguageDetector({ expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(2);
    await expect(retry.ready).resolves.toBeUndefined();
    retry.release();
  });

  it("defers destruction while inference is in flight", async () => {
    const { instances } = installFakeApi();
    const lease = prepareLanguageDetector({ expectedInputLanguages: ["en"] });
    await lease.ready;

    const instance = instances[0];
    if (!instance) throw new Error("expected a created instance");
    let resolveDetect: (results: typeof RESULTS) => void = () => {};
    instance.detect.mockImplementationOnce(
      () =>
        new Promise<typeof RESULTS>((resolve) => {
          resolveDetect = resolve;
        }),
    );

    const running = detect({ input: "hello", expectedInputLanguages: ["en"] });
    await tick();
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveDetect(RESULTS);
    await expect(running).resolves.toMatchObject({
      output: { language: "en" },
      cached: false,
    });
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });

  it("pins leased entries against LRU eviction", async () => {
    const { instances } = installFakeApi();
    configureLanguageDetectorCache({ max: 1 });

    const lease = prepareLanguageDetector({ expectedInputLanguages: ["en"] });
    await lease.ready;
    await detect({ input: "hola", expectedInputLanguages: ["es"] });
    await tick();

    // Inserting a third entry trims to max; the leased "en" session survives
    // and the unpinned "es" session is evicted.
    const third = prepareLanguageDetector({ expectedInputLanguages: ["ja"] });
    await third.ready;
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();
    expect(instances[1]?.destroy).toHaveBeenCalledTimes(1);

    lease.release();
    third.release();
  });

  it("isolates leases per option key", async () => {
    const { api, instances } = installFakeApi();
    const english = prepareLanguageDetector({
      expectedInputLanguages: ["en"],
    });
    await english.ready;

    await detect({ input: "hola", expectedInputLanguages: ["es"] });
    expect(api.create).toHaveBeenCalledTimes(2);

    english.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(instances[1]?.destroy).not.toHaveBeenCalled();

    // The other configuration stays cached and reusable.
    await detect({ input: "hola", expectedInputLanguages: ["es"] });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("clear detaches leased sessions and destroys them on final release", async () => {
    const { api, instances } = installFakeApi();
    const lease = prepareLanguageDetector({ expectedInputLanguages: ["en"] });
    await lease.ready;

    clearLanguageDetectorSessions();
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();

    // The detached session no longer serves new calls.
    await detect({ input: "hello", expectedInputLanguages: ["en"] });
    expect(api.create).toHaveBeenCalledTimes(2);

    lease.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("re-trims the cache when the last in-flight pin drops", async () => {
    const { api, instances } = installFakeApi();
    configureLanguageDetectorCache({ max: 0 });

    await detect({ input: "hola", expectedInputLanguages: ["es"] });
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);

    // Nothing stayed cached, so the same call creates a fresh session.
    await detect({ input: "hola", expectedInputLanguages: ["es"] });
    expect(api.create).toHaveBeenCalledTimes(2);
  });
});
