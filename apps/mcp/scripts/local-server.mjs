import { fileURLToPath } from "node:url";
import { resolveDevelopmentService } from "../../../scripts/development-instance.mjs";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function buildWranglerDevArgs(
  env = process.env,
  root = repositoryRoot,
) {
  const server = resolveDevelopmentService("mcp", root, env);
  const inspector = resolveDevelopmentService("mcpInspector", root, env);

  if (
    server.instance.primary &&
    !server.configured &&
    !inspector.configured
  ) {
    return ["exec", "wrangler", "dev"];
  }

  return [
    "exec",
    "wrangler",
    "dev",
    "--ip",
    server.bindHost ?? "127.0.0.1",
    "--port",
    String(server.port),
    "--inspector-port",
    String(inspector.port),
  ];
}
