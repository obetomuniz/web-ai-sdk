import {
  childProcessExitCode,
  spawnManagedProcess,
} from "../../../scripts/process-tree.mjs";
import { buildWranglerDevArgs } from "./local-server.mjs";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawnManagedProcess(pnpmCommand, buildWranglerDevArgs(), {
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  process.exitCode = childProcessExitCode(code, signal);
});
