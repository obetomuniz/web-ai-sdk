import { createMcpHandler } from "@modelcontextprotocol/server";
import {
  createDocumentationServer,
  SERVER_NAME,
  SERVER_VERSION,
} from "./server.js";

const mcpHandler = createMcpHandler(createDocumentationServer);
const maxRequestBodyBytes = 64 * 1024;
const rateLimitSeconds = 60;
const allowedOrigins = new Set([
  "https://web-ai-sdk.dev",
  "https://mcp.web-ai-sdk.dev",
]);

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface WorkerEnv {
  MCP_RATE_LIMITER: RateLimitBinding;
}

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

const readBoundedRequest = async (
  request: Request,
): Promise<Request | null> => {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null && Number(contentLength) > maxRequestBodyBytes) {
    return null;
  }

  if (!request.body) return request;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      byteLength += value.byteLength;
      if (byteLength > maxRequestBodyBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });
};

export const fetchRequest = async (
  request: Request,
  env: WorkerEnv,
): Promise<Response> => {
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

  const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rateLimit = await env.MCP_RATE_LIMITER.limit({
    key: `mcp:${clientIp}`,
  });
  if (!rateLimit.success) {
    const response = json({ error: "Too many requests." }, 429);
    response.headers.set("Retry-After", String(rateLimitSeconds));
    return withCors(response, origin);
  }

  const boundedRequest = await readBoundedRequest(request);
  if (!boundedRequest) {
    return withCors(json({ error: "Request body is too large." }, 413), origin);
  }

  const response = await mcpHandler.fetch(boundedRequest);
  return withCors(response, origin);
};

export default { fetch: fetchRequest };
