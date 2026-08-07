import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearSessionCacheForTests,
  configureTranslatorCache,
} from "./api.js";
import {
  clearTranslatorSessions,
  prepareTranslator,
  TranslatorUnavailableError,
  translate,
} from "./index.js";

interface FakeTranslator {
  translate: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const makeInstance = (): FakeTranslator => ({
  translate: vi.fn(async (text: string) => `[t]${text}`),
  destroy: vi.fn(),
});

const installFakeApi = () => {
  const instances: FakeTranslator[] = [];
  const api = {
    availability: vi.fn(async () => "available" as const),
    create: vi.fn(async () => {
      const instance = makeInstance();
      instances.push(instance);
      return instance;
    }),
  };
  (globalThis as { Translator?: unknown }).Translator = api;
  return { api, instances };
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  __clearSessionCacheForTests();
});

afterEach(() => {
  (globalThis as { Translator?: unknown }).Translator = undefined;
});

describe("prepareTranslator", () => {
  it("starts creation immediately and the matching translate reuses it", async () => {
    const { api } = installFakeApi();
    const lease = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    expect(api.create).toHaveBeenCalledTimes(1);
    await lease.ready;

    const result = await translate({
      input: "Olá",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    expect(result.output).toBe("[t]Olá");
    expect(api.create).toHaveBeenCalledTimes(1);
    lease.release();
  });

  it("never throws when the API is missing; ready rejects instead", async () => {
    const lease = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await expect(lease.ready).rejects.toBeInstanceOf(
      TranslatorUnavailableError,
    );
    expect(() => lease.release()).not.toThrow();
  });

  it("shares one session between concurrent leases and destroys exactly once", async () => {
    const { api, instances } = installFakeApi();
    const first = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    const second = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
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
    let resolveCreate: (instance: FakeTranslator) => void = () => {};
    const instance = makeInstance();
    api.create.mockImplementationOnce(
      () =>
        new Promise<FakeTranslator>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const lease = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveCreate(instance);
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);

    // The released entry left the cache, so preparing again creates anew.
    const retry = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    expect(api.create).toHaveBeenCalledTimes(2);
    await retry.ready;
    retry.release();
  });

  it("creation failure rejects ready, evicts the entry, and allows retry", async () => {
    const { api } = installFakeApi();
    api.create.mockRejectedValueOnce(new Error("no space"));

    const failed = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await expect(failed.ready).rejects.toBeInstanceOf(
      TranslatorUnavailableError,
    );
    failed.release();

    const retry = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    expect(api.create).toHaveBeenCalledTimes(2);
    await expect(retry.ready).resolves.toBeUndefined();
    retry.release();
  });

  it("defers destruction while inference is in flight", async () => {
    const { instances } = installFakeApi();
    const lease = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await lease.ready;

    const instance = instances[0];
    if (!instance) throw new Error("expected a created instance");
    let resolveTranslate: (text: string) => void = () => {};
    instance.translate.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveTranslate = resolve;
        }),
    );

    const running = translate({
      input: "Olá",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await tick();
    lease.release();
    await tick();
    expect(instance.destroy).not.toHaveBeenCalled();

    resolveTranslate("[t]Olá");
    await expect(running).resolves.toEqual({
      output: "[t]Olá",
      cached: false,
    });
    await tick();
    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });

  it("pins leased entries against LRU eviction", async () => {
    const { instances } = installFakeApi();
    configureTranslatorCache({ max: 1 });

    const lease = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await lease.ready;
    await translate({
      input: "Hola",
      sourceLanguage: "es",
      targetLanguage: "en",
    });
    await tick();

    // Inserting a third entry trims to max; the leased "pt->en" session
    // survives and the unpinned "es->en" session is evicted.
    const third = prepareTranslator({
      sourceLanguage: "fr",
      targetLanguage: "en",
    });
    await third.ready;
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();
    expect(instances[1]?.destroy).toHaveBeenCalledTimes(1);

    lease.release();
    third.release();
  });

  it("isolates leases per language pair", async () => {
    const { api, instances } = installFakeApi();
    const ptToEn = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await ptToEn.ready;

    await translate({
      input: "Hola",
      sourceLanguage: "es",
      targetLanguage: "en",
    });
    expect(api.create).toHaveBeenCalledTimes(2);

    ptToEn.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(instances[1]?.destroy).not.toHaveBeenCalled();

    // The other language pair stays cached and reusable.
    await translate({
      input: "Hola",
      sourceLanguage: "es",
      targetLanguage: "en",
    });
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("clear detaches leased sessions and destroys them on final release", async () => {
    const { api, instances } = installFakeApi();
    const lease = prepareTranslator({
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await lease.ready;

    clearTranslatorSessions();
    await tick();
    expect(instances[0]?.destroy).not.toHaveBeenCalled();

    // The detached session no longer serves new calls.
    await translate({
      input: "Olá",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    expect(api.create).toHaveBeenCalledTimes(2);

    lease.release();
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("re-trims the cache when the last in-flight pin drops", async () => {
    const { api, instances } = installFakeApi();
    configureTranslatorCache({ max: 0 });

    await translate({
      input: "Olá",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    await tick();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);

    // Nothing stayed cached, so the same call creates a fresh session.
    await translate({
      input: "Olá",
      sourceLanguage: "pt",
      targetLanguage: "en",
    });
    expect(api.create).toHaveBeenCalledTimes(2);
  });
});
