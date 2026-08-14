# web-ai-sdk documentation MCP

This private app serves the checked-in web-ai-sdk documentation through a
read-only Model Context Protocol endpoint. A Cloudflare Worker hosts the remote
endpoint. The published SDK packages do not depend on this app.

## Content

The build reads every Markdown and MDX page in
`apps/site/src/content/docs/`. It removes render-only MDX components and bundles
the resulting catalog with the Worker. Package pages remain synchronized with
their package READMEs through the existing site documentation check.

The server exposes:

- `search_docs`: search package references, guides, React hooks, and concepts;
- `read_doc`: read one complete canonical page;
- `get_browser_support`: read current Chrome and Edge support;
- one MCP resource for every documentation page.

All tools are public, read-only, and stateless. They do not execute browser AI
APIs or access user data.

Requests to `/mcp` accept a maximum 64 KiB request body. The deployed Worker
allows 120 requests per minute for each Cloudflare client IP. Requests above
these limits return `413` or `429`.

Cloudflare enforces the rate limit per data center. Treat it as an abuse control,
not a precise global quota.

## Local development

From the repository root:

```sh
pnpm mcp
```

Wrangler prints the local address. Connect an MCP client to its `/mcp` path.
The Worker also serves health metadata at `/health`.

Run focused checks with:

```sh
pnpm --filter @web-ai-sdk-apps/mcp build
pnpm --filter @web-ai-sdk-apps/mcp typecheck
pnpm --filter @web-ai-sdk-apps/mcp test
```

## Deployment

The `Deploy MCP` GitHub Actions workflow deploys relevant changes after they
reach `main`. Maintainers can also run it manually. It uses the `mcp-production`
environment and deploys the Worker to `mcp.web-ai-sdk.dev`. The MCP endpoint is
`https://mcp.web-ai-sdk.dev/mcp`.

Configure these GitHub Actions secrets before the first deployment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Create an API token that can edit Workers scripts and Worker custom domains for
the `web-ai-sdk.dev` zone. Store the values in GitHub. Do not commit them or add
them to local environment files.
