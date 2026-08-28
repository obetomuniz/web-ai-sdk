import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanDevelopmentArtifacts,
  collectDevelopmentArtifacts,
} from "../../../scripts/development-clean.mjs";

const temporaryRoots = [];

function createCheckout() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "web-ai-sdk-clean-"));
  temporaryRoots.push(root);

  for (const directory of [
    "node_modules",
    ".pnpm-store",
    "_site",
    "apps/site/node_modules",
    "apps/site/.astro",
    "apps/site/dist",
    "apps/site/src",
    "apps/mcp/.wrangler",
    "apps/mcp/src/generated",
    "packages/prompt/node_modules",
    "packages/prompt/dist",
    ".ideas",
  ]) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }

  for (const file of [
    ".env",
    ".npmrc",
    ".ideas/notes.md",
    "apps/site/src/index.ts",
  ]) {
    fs.writeFileSync(path.join(root, file), "keep");
  }

  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

describe("development cleanup", () => {
  it("removes only known generated artifacts", () => {
    const root = createCheckout();
    const removed = cleanDevelopmentArtifacts(root);

    expect(removed).toContain("node_modules");
    expect(removed).toContain(path.join("apps", "site", ".astro"));
    expect(removed).toContain(path.join("apps", "mcp", ".wrangler"));
    expect(removed).toContain(
      path.join("apps", "mcp", "src", "generated"),
    );
    expect(removed).toContain(path.join("packages", "prompt", "dist"));
    expect(fs.existsSync(path.join(root, "node_modules"))).toBe(false);
    expect(fs.existsSync(path.join(root, "apps/site/dist"))).toBe(false);
    expect(fs.readFileSync(path.join(root, ".env"), "utf8")).toBe("keep");
    expect(fs.readFileSync(path.join(root, ".npmrc"), "utf8")).toBe("keep");
    expect(fs.readFileSync(path.join(root, ".ideas/notes.md"), "utf8")).toBe(
      "keep",
    );
    expect(fs.readFileSync(path.join(root, "apps/site/src/index.ts"), "utf8")).toBe(
      "keep",
    );
  });

  it("supports a dry run and repeated cleanup", () => {
    const root = createCheckout();
    const expected = collectDevelopmentArtifacts(root).map((artifact) =>
      path.relative(root, artifact),
    );

    expect(cleanDevelopmentArtifacts(root, { dryRun: true })).toEqual(expected);
    expect(fs.existsSync(path.join(root, "node_modules"))).toBe(true);

    cleanDevelopmentArtifacts(root);
    expect(cleanDevelopmentArtifacts(root)).toEqual([]);
  });

  it("does not follow an artifact symlink outside the checkout", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "web-ai-sdk-clean-"));
    const external = fs.mkdtempSync(
      path.join(os.tmpdir(), "web-ai-sdk-clean-external-"),
    );
    temporaryRoots.push(root, external);
    fs.writeFileSync(path.join(external, "keep.txt"), "keep");
    fs.symlinkSync(external, path.join(root, "node_modules"), "dir");

    cleanDevelopmentArtifacts(root);

    expect(fs.existsSync(path.join(root, "node_modules"))).toBe(false);
    expect(fs.readFileSync(path.join(external, "keep.txt"), "utf8")).toBe(
      "keep",
    );
  });
});
