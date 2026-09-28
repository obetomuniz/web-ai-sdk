import {
  childProcessExitCode,
  spawnManagedProcess,
} from "../../../.configs/dev/scripts/process-tree.mjs";
import { buildWranglerDevArgs } from "./local-server.mjs";

const child = spawnManagedProcess("pnpm", buildWranglerDevArgs(), {
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  process.exitCode = childProcessExitCode(code, signal);
});
