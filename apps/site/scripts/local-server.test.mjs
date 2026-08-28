import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveLocalServer } from "./local-server.mjs";

const temporaryRoots = [];

function createCheckout(primary) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "web-ai-sdk-site-"));
  temporaryRoots.push(root);

  if (primary) {
    fs.mkdirSync(path.join(root, ".git"));
  } else {
    fs.writeFileSync(path.join(root, ".git"), "gitdir: elsewhere");
  }

  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

describe("resolveLocalServer", () => {
  it("keeps the existing site defaults in the primary checkout", () => {
    const root = createCheckout(true);

    expect(resolveLocalServer("dev", {}, root)).toEqual({
      host: false,
      port: 5173,
    });
    expect(resolveLocalServer("preview", {}, root)).toEqual({
      host: false,
      port: 4173,
    });
  });

  it("uses stable isolated addresses in a linked worktree", () => {
    const root = createCheckout(false);
    const first = resolveLocalServer("dev", {}, root);
    const second = resolveLocalServer("dev", {}, root);

    expect(first).toEqual(second);
    expect(first.host).toBe("127.0.0.1");
    expect(first.port).toBeGreaterThanOrEqual(20_000);
    expect(first.port).toBeLessThan(25_000);
  });

  it("accepts generic host and port overrides", () => {
    expect(
      resolveLocalServer(
        "dev",
        {
          WEB_AI_SDK_HOST: "0.0.0.0",
          WEB_AI_SDK_SITE_PORT: "23456",
        },
        createCheckout(true),
      ),
    ).toEqual({
      host: "0.0.0.0",
      port: 23456,
    });
  });

  it("rejects invalid generic ports", () => {
    const root = createCheckout(true);

    expect(() =>
      resolveLocalServer(
        "dev",
        { WEB_AI_SDK_SITE_PORT: "not-a-port" },
        root,
      ),
    ).toThrow(
      "WEB_AI_SDK_SITE_PORT must be an integer from 1 through 65535.",
    );
    expect(() =>
      resolveLocalServer(
        "dev",
        { WEB_AI_SDK_SITE_PORT: "65536" },
        root,
      ),
    ).toThrow(
      "WEB_AI_SDK_SITE_PORT must be an integer from 1 through 65535.",
    );
  });
});
