import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import { fetchRequest } from "./index.js";

const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

const connectClient = async (): Promise<Client> => {
  const transport = new StreamableHTTPClientTransport(
    new URL("https://mcp.web-ai-sdk.dev/mcp"),
    {
      fetch: (input, init) => fetchRequest(new Request(input, init)),
    },
  );
  const client = new Client(
    { name: "web-ai-sdk-docs-test", version: "1.0.0" },
    { versionNegotiation: { mode: "auto" } },
  );
  clients.push(client);
  await client.connect(transport);
  return client;
};

describe("documentation MCP server", () => {
  it("serves modern MCP tools and resources in-process", async () => {
    const client = await connectClient();

    expect(client.getProtocolEra()).toBe("modern");
    expect(client.getServerVersion()?.name).toBe("web-ai-sdk-docs");

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "search_docs",
      "read_doc",
      "get_browser_support",
    ]);

    const search = await client.callTool({
      name: "search_docs",
      arguments: { query: "WebMCP registerTool", limit: 2 },
    });
    expect(search.isError).not.toBe(true);
    expect(JSON.stringify(search.structuredContent)).toContain("guides/webmcp");

    const support = await client.callTool({
      name: "get_browser_support",
      arguments: { capability: "Prompt" },
    });
    expect(JSON.stringify(support.structuredContent)).toContain(
      "@web-ai-sdk/prompt",
    );

    const resources = await client.listResources();
    expect(resources.resources).toHaveLength(33);
    const page = await client.readResource({
      uri: "web-ai-sdk://docs/architecture",
    });
    expect(page.contents[0]).toMatchObject({ mimeType: "text/markdown" });
    expect(JSON.stringify(page.contents[0])).toContain(
      "One package per browser capability",
    );
  });

  it("returns service metadata and bounded routing responses", async () => {
    const health = await fetchRequest(
      new Request("https://mcp.web-ai-sdk.dev/health"),
    );
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({
      status: "ok",
      endpoint: "/mcp",
    });

    const missing = await fetchRequest(
      new Request("https://mcp.web-ai-sdk.dev/unknown"),
    );
    expect(missing.status).toBe(404);
  });

  it("rejects untrusted browser origins", async () => {
    const response = await fetchRequest(
      new Request("https://mcp.web-ai-sdk.dev/mcp", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("preserves response status for trusted browser origins", async () => {
    const response = await fetchRequest(
      new Request("https://mcp.web-ai-sdk.dev/unknown", {
        headers: { Origin: "https://web-ai-sdk.dev" },
      }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://web-ai-sdk.dev",
    );
  });
});
