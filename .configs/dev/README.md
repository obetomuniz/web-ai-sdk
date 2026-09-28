# Development tools

Shared repository development tools live in `scripts/` within this directory.
The published SDK packages do not import these tools.
Keep app-specific scripts in `apps/<name>/scripts/`.

| Script | Purpose |
| --- | --- |
| `development-clean.mjs` | Removes generated checkout artifacts through `pnpm dev:clean`. |
| `development-info.mjs` | Prints development instance identity and URLs through `pnpm dev:info`. |
| `development-instance.mjs` | Resolves shared checkout identities, hosts, and service ports. |
| `paseo-service.mjs` | Adapts optional Paseo service settings to site, preview, and MCP commands. |
| `process-tree.mjs` | Manages child process termination for development launchers. |

The site and MCP test suites cover the shared tools and their app integrations.
See the [contribution guide](../../CONTRIBUTING.md) for development commands.
