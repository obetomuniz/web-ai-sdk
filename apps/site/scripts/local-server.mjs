import { fileURLToPath } from "node:url";
import { resolveDevelopmentService } from "../../../scripts/development-instance.mjs";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function resolveLocalServer(
  command,
  env = process.env,
  root = repositoryRoot,
) {
  const service = resolveDevelopmentService(
    command === "dev" ? "site" : "preview",
    root,
    env,
  );

  return {
    host: service.bindHost ?? false,
    port: service.port,
  };
}
