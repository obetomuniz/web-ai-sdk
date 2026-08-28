import { spawn } from "node:child_process";

const SIGNAL_EXIT_CODES = Object.freeze({
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143,
});
const TERMINATION_SIGNALS =
  process.platform === "win32"
    ? Object.freeze(["SIGINT", "SIGTERM"])
    : Object.freeze(["SIGHUP", "SIGINT", "SIGTERM"]);

export function terminateProcessTree(child, signal = "SIGTERM") {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    const taskkill = spawn(
      "taskkill",
      ["/pid", String(child.pid), "/t", "/f"],
      {
        stdio: "ignore",
        windowsHide: true,
      },
    );
    taskkill.once("error", () => child.kill());
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") {
      child.kill(signal);
    }
  }
}

export function spawnManagedProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    detached: process.platform !== "win32",
  });
  const signalHandlers = new Map();

  for (const signal of TERMINATION_SIGNALS) {
    const handler = () => terminateProcessTree(child, signal);
    signalHandlers.set(signal, handler);
    process.once(signal, handler);
  }

  child.once("close", () => {
    for (const [signal, handler] of signalHandlers) {
      process.removeListener(signal, handler);
    }
  });

  return child;
}

export function childProcessExitCode(code, signal) {
  return code ?? SIGNAL_EXIT_CODES[signal] ?? 1;
}
