import { createMcpHandler } from "@modelcontextprotocol/server";
import {
  createDocumentationServer,
  SERVER_NAME,
  SERVER_VERSION,
} from "./server.js";

const mcpHandler = createMcpHandler(createDocumentationServer);
const allowedOrigins = new Set([
  "https://web-ai-sdk.dev",
  "https://mcp.web-ai-sdk.dev",
]);

const corsHeaders = (origin: string): HeadersInit => ({
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Expose-Headers": "MCP-Protocol-Version, Retry-After",
  Vary: "Origin",
});

const withCors = (response: Response, origin: string | null): Response => {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(origin))) {
    if (typeof value === "string") headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const json = (value: unknown, status = 200): Response =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export const fetchRequest = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");

  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: "Origin is not allowed." }, 403);
  }

  if (request.method === "OPTIONS") {
    if (!origin) return new Response(null, { status: 204 });
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (url.pathname === "/" || url.pathname === "/health") {
    return withCors(
      json({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        status: "ok",
        endpoint: "/mcp",
        documentation: "https://web-ai-sdk.dev/docs/",
      }),
      origin,
    );
  }

  if (url.pathname !== "/mcp") {
    return withCors(json({ error: "Not found." }, 404), origin);
  }

  const response = await mcpHandler.fetch(request);
  return withCors(response, origin);
};

export default { fetch: fetchRequest };
