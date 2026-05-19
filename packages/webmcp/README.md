# @web-ai-sdk/webmcp

Building block for the W3C [WebMCP](https://webmachinelearning.github.io/webmcp/) API exposed at `navigator.modelContext`.

An ergonomic, framework-agnostic adapter over the native browser API, with safe register/unregister cleanup and a feature-detected no-op fallback for non-supporting browsers.

## Status

WebMCP ships in Chrome 146+ and Edge 146+ behind a flag (`chrome://flags/#enable-webmcp-testing`; the Edge flag has the same name). On any browser that doesn't expose `navigator.modelContext`, this library is a no-op. Your app stays callable, and no tools get registered.

## Install

```sh
pnpm add @web-ai-sdk/webmcp
# or: npm i @web-ai-sdk/webmcp / bun add @web-ai-sdk/webmcp
```

React adapter is shipped as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## Vanilla TypeScript / DOM

```ts
import { registerTools } from "@web-ai-sdk/webmcp";

const cleanup = registerTools([
  {
    name: "list_blog_posts",
    description: "List published blog posts.",
    readOnly: true,
    execute: async () => {
      const res = await fetch("/api/posts.json");
      return { results: await res.json() };
    },
  },
  {
    name: "send_contact_email",
    description:
      "Send a contact email on behalf of the visitor. Confirm the body with the user before invoking.",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        email: { type: "string", format: "email" },
        subject: { type: "string", minLength: 1 },
        message: { type: "string", minLength: 1 },
      },
      required: ["name", "email", "subject", "message"],
    },
    execute: async (input) => {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true };
    },
  },
]);

// later, e.g. on page teardown
cleanup();
```

`registerTool(tool)` registers a single tool and returns the cleanup. `registerTools([...])` registers many and returns one cleanup that disposes all of them. Re-registering a tool with the same name is safe; the previous registration is dropped first.

## React

```tsx
import { useWebMCP, type Tool } from "@web-ai-sdk/webmcp/react";
import { useMemo } from "react";

const TOOLS: Tool[] = [
  {
    name: "list_blog_posts",
    description: "List published blog posts.",
    readOnly: true,
    execute: async () => {
      const res = await fetch("/api/posts.json");
      return { results: await res.json() };
    },
  },
];

export function WebMCP() {
  // Stable reference: keep tools outside the component or wrap in useMemo,
  // otherwise the hook will unregister/re-register on every render.
  const tools = useMemo(() => TOOLS, []);
  useWebMCP(tools);
  return null;
}
```

The hook registers on mount, unregisters on unmount, and re-registers when the array reference changes.

## API

### `registerTool(tool): () => void`

Register a single tool. Returns a cleanup function. No-op on unsupported browsers.

### `registerTools(tools): () => void`

Register many tools at once. Returns a single cleanup that unregisters all of them.

### `isWebMCPAvailable(): boolean`

Feature-detect helper.

### `getModelContext(): ModelContext | undefined`

Escape hatch: the raw `navigator.modelContext` if present, for cases the wrapper doesn't cover (e.g. `requestUserInteraction`).

### `Tool<TInput, TOutput>`

```ts
interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema?: object; // JSON Schema
  readOnly?: boolean; // shorthand for annotations.readOnlyHint
  destructive?: boolean; // shorthand for annotations.destructiveHint
  annotations?: ToolAnnotations; // raw passthrough, merged on top
  execute: (input: TInput) => Promise<TOutput> | TOutput;
}
```

`description` is consumed by the agent host (Cursor / Claude / Chrome agent / etc.). Write it as an instruction to an LLM about when to call the tool.

## Safety

Mark mutating tools `destructive: true`. The host (browser, agent) is responsible for gating destructive tools on explicit user approval; `@web-ai-sdk/webmcp` only forwards the annotation. For sensitive operations also defend server-side (origin allowlist, rate limit, validation).

## Troubleshooting

- **Inspector / agent doesn't see the tools.** `navigator.modelContext` is per-Window. Tools registered inside an `<iframe>` are scoped to that frame and invisible to extensions hooked into the top page. Register from the top-level document, not from an embedded frame.

## License

MIT © Beto Muniz
