import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildWranglerDevArgs } from "./local-server.mjs";

const temporaryRoots = [];

function createCheckout(primary) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "web-ai-sdk-mcp-"));
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

describe("buildWranglerDevArgs", () => {
  it("keeps Wrangler defaults in the primary checkout", () => {
    expect(buildWranglerDevArgs({}, createCheckout(true))).toEqual([
      "exec",
      "wrangler",
      "dev",
    ]);
  });

  it("uses stable MCP and inspector ports in a linked worktree", () => {
    const args = buildWranglerDevArgs({}, createCheckout(false));
    const port = Number(args[args.indexOf("--port") + 1]);
    const inspectorPort = Number(args[args.indexOf("--inspector-port") + 1]);

    expect(args.slice(0, 5)).toEqual([
      "exec",
      "wrangler",
      "dev",
      "--ip",
      "127.0.0.1",
    ]);
    expect(port).toBeGreaterThanOrEqual(40_000);
    expect(port).toBeLessThan(45_000);
    expect(inspectorPort).toBeGreaterThanOrEqual(50_000);
    expect(inspectorPort).toBeLessThan(55_000);
  });

  it("accepts generic host, server, and inspector overrides", () => {
    expect(
      buildWranglerDevArgs(
        {
          WEB_AI_SDK_HOST: "127.0.0.1",
          WEB_AI_SDK_MCP_INSPECTOR_PORT: "0",
          WEB_AI_SDK_MCP_PORT: "24567",
        },
        createCheckout(true),
      ),
    ).toEqual([
      "exec",
      "wrangler",
      "dev",
      "--ip",
      "127.0.0.1",
      "--port",
      "24567",
      "--inspector-port",
      "0",
    ]);
  });

  it("rejects invalid generic ports", () => {
    const root = createCheckout(true);

    expect(() =>
      buildWranglerDevArgs({ WEB_AI_SDK_MCP_PORT: "0" }, root),
    ).toThrow("WEB_AI_SDK_MCP_PORT must be an integer from 1 through 65535.");
    expect(() =>
      buildWranglerDevArgs(
        { WEB_AI_SDK_MCP_INSPECTOR_PORT: "12.5" },
        root,
      ),
    ).toThrow(
      "WEB_AI_SDK_MCP_INSPECTOR_PORT must be an integer from 0 through 65535.",
    );
  });
});
