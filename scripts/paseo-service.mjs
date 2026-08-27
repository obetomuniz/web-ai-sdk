import {
  childProcessExitCode,
  spawnManagedProcess,
} from "./process-tree.mjs";

const SERVICES = Object.freeze({
  site: Object.freeze({
    args: ["dev"],
    portVariable: "WEB_AI_SDK_SITE_PORT",
  }),
  preview: Object.freeze({
    args: ["pages:preview"],
    portVariable: "WEB_AI_SDK_PREVIEW_PORT",
  }),
  mcp: Object.freeze({
    args: ["mcp"],
    portVariable: "WEB_AI_SDK_MCP_PORT",
  }),
});

const serviceName = process.argv[2];
const service = SERVICES[serviceName];

if (!service) {
  console.error(`Unknown Paseo service: ${serviceName ?? "<missing>"}`);
  process.exit(1);
}

const paseoPort = process.env.PASEO_PORT?.trim();

if (!paseoPort) {
  console.error("PASEO_PORT is required for a Paseo service.");
  process.exit(1);
}

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const environment = {
  ...process.env,
  [service.portVariable]: paseoPort,
  WEB_AI_SDK_HOST:
    process.env.WEB_AI_SDK_HOST?.trim() ||
    process.env.HOST?.trim() ||
    "127.0.0.1",
};

if (serviceName === "mcp") {
  environment.WEB_AI_SDK_MCP_INSPECTOR_PORT = "0";
}

const child = spawnManagedProcess(pnpmCommand, service.args, {
  env: environment,
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  process.exitCode = childProcessExitCode(code, signal);
});
