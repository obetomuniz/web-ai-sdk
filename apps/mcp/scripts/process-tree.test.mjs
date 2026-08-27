import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import {
  spawnManagedProcess,
  terminateProcessTree,
} from "../../../scripts/process-tree.mjs";

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntilStopped(pid) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!isRunning(pid)) {
      return true;
    }

    await delay(20);
  }

  return false;
}

describe("managed process trees", () => {
  it.skipIf(process.platform === "win32")(
    "terminates a spawned process and its descendants",
    async () => {
      const childSource = `
        const { spawn } = require("node:child_process");
        const grandchild = spawn(
          process.execPath,
          ["-e", "setInterval(() => {}, 1000)"],
          { stdio: "ignore" },
        );
        process.stdout.write(String(grandchild.pid));
        setInterval(() => {}, 1000);
      `;
      const child = spawnManagedProcess(
        process.execPath,
        ["-e", childSource],
        { stdio: ["ignore", "pipe", "ignore"] },
      );
      const [output] = await once(child.stdout, "data");
      const grandchildPid = Number(String(output));
      const childExit = once(child, "exit");

      expect(grandchildPid).toBeGreaterThan(0);
      terminateProcessTree(child, "SIGTERM");
      await childExit;

      expect(await waitUntilStopped(grandchildPid)).toBe(true);
    },
  );
});
