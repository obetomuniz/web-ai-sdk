import { fileURLToPath } from "node:url";
import {
  resolveDevelopmentInstance,
  resolveDevelopmentService,
} from "./development-instance.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const instance = resolveDevelopmentInstance(root);

console.log(`Development instance: ${instance.id}`);
console.log(`Source: ${instance.source}`);

for (const [label, service] of [
  ["Site", "site"],
  ["Preview", "preview"],
  ["MCP", "mcp"],
]) {
  console.log(`${label}: ${resolveDevelopmentService(service, root).url}`);
}
