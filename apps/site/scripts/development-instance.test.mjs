import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeDevelopmentInstanceId,
  resolveDevelopmentInstance,
  resolveDevelopmentService,
} from "../../../scripts/development-instance.mjs";

const temporaryRoots = [];

function createCheckout(name, primary) {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "web-ai-sdk-instance-"),
  );
  const root = path.join(parent, name);
  temporaryRoots.push(parent);
  fs.mkdirSync(root);

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

describe("development instances", () => {
  it("uses the reserved default identity for the primary checkout", () => {
    expect(
      resolveDevelopmentInstance(createCheckout("sdk", true), {}),
    ).toMatchObject({
      id: "default",
      portSlot: 0,
      primary: true,
      source: "primary-checkout",
    });
  });

  it("derives a stable path-safe identity for a linked worktree", () => {
    const root = createCheckout("Issue 224 ç", false);
    const first = resolveDevelopmentInstance(root, {});
    const second = resolveDevelopmentInstance(root, {});

    expect(first).toEqual(second);
    expect(first.id).toMatch(/^issue-224-c-[a-f0-9]{8}$/);
    expect(first.primary).toBe(false);
    expect(first.source).toBe("linked-worktree");
    expect(first.portSlot).toBeGreaterThanOrEqual(0);
    expect(first.portSlot).toBeLessThan(5_000);
  });

  it("supports an explicit tool-neutral instance override", () => {
    const root = createCheckout("sdk", true);
    const instance = resolveDevelopmentInstance(root, {
      WEB_AI_SDK_DEV_INSTANCE: "Issue 227 / Review",
    });

    expect(instance).toMatchObject({
      id: "issue-227-review",
      primary: false,
      source: "override",
    });
    expect(
      resolveDevelopmentService("site", root, {
        WEB_AI_SDK_DEV_INSTANCE: "Issue 227 / Review",
      }).hostname,
    ).toBe("site--issue-227-review.web-ai-sdk.localhost");
  });

  it("rejects empty and reserved normalized overrides", () => {
    const root = createCheckout("sdk", true);

    expect(() =>
      resolveDevelopmentInstance(root, {
        WEB_AI_SDK_DEV_INSTANCE: "!!!",
      }),
    ).toThrow(
      "WEB_AI_SDK_DEV_INSTANCE must normalize to a non-reserved identifier.",
    );
    expect(() =>
      resolveDevelopmentInstance(root, {
        WEB_AI_SDK_DEV_INSTANCE: "default",
      }),
    ).toThrow(
      "WEB_AI_SDK_DEV_INSTANCE must normalize to a non-reserved identifier.",
    );
  });

  it("normalizes accents, separators, and length", () => {
    expect(normalizeDevelopmentInstanceId("  Revisão / Issue 224  ")).toBe(
      "revisao-issue-224",
    );
    expect(normalizeDevelopmentInstanceId("abcdefghij", 5)).toBe("abcde");
  });
});
