# @web-ai-sdk/webmcp

This package wraps the W3C [WebMCP](https://webmachinelearning.github.io/webmcp/) API at `document.modelContext`. It also reads the previous `navigator.modelContext` shape for compatibility.

The package provides typed registration, cleanup, discovery, and execution. It has no framework dependency.

**Docs:** <https://web-ai-sdk.dev/docs/guides/webmcp/> · **React:** [`useWebMCP`](https://web-ai-sdk.dev/docs/react/use-web-mcp/)

## Status

Chrome provides a public [origin trial from Chrome 149](https://developer.chrome.com/docs/ai/webmcp). For local development, enable `chrome://flags/#enable-webmcp-testing`. Microsoft lists WebMCP in the [Edge 150 origin trials](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/release-notes/150).

Without WebMCP, registration is a no-op and discovery returns an empty list. Execution throws `WebMCPUnavailableError`.

Current `registerTool` implementations can be synchronous or asynchronous. The package supports both forms.

## Install

```sh
pnpm add @web-ai-sdk/webmcp
# or: npm i @web-ai-sdk/webmcp / bun add @web-ai-sdk/webmcp
```

React adapter is shipped as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## Vanilla TypeScript / DOM

```ts
import { registerTool } from "@web-ai-sdk/webmcp";

const tools = [
  {
    name: "list_blog_posts",
    title: "List blog posts",
    description: "List published blog posts.",
    readOnly: true,
    annotations: { untrustedContentHint: true },
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
];

const cleanups = tools.map(registerTool);
const cleanup = () => cleanups.forEach((c) => c());

// later, e.g. on page teardown
cleanup();
```

`registerTool(tool, options?)` registers a single tool and returns the cleanup. Re-registering a tool with the same name is safe; the previous registration is dropped first.

## React

```tsx
import { useWebMCP } from "@web-ai-sdk/webmcp/react";
import { z } from "zod"; // Zod 4; other Standard Schema libraries work too

const SearchPostsInput = z.object({ query: z.string().min(1) });

export function WebMCP({ isSignedIn }: { isSignedIn: boolean }) {
  const { tools, status } = useWebMCP(
    {
      name: "search_blog_posts",
      description: "Search published blog posts.",
      readOnly: true,
      input: SearchPostsInput,
      inputSchema: z.toJSONSchema(SearchPostsInput, {
        io: "input",
        target: "draft-2020-12",
      }),
      execute: async ({ query }) => {
        const res = await fetch(`/api/posts.json?q=${encodeURIComponent(query)}`);
        return { results: await res.json() };
      },
    },
    { enabled: isSignedIn },
  );

  return <p>{status === "ready" ? `${tools.length} tools` : status}</p>;
}
```

`useWebMCP` accepts one tool or a readonly array. It registers on mount and unregisters on unmount. Setting `enabled` to `false` also removes the registration.

Registration follows tool metadata and `exposedTo` values, not object identity. `execute` always uses the latest callback. Inline objects and arrays are safe. Metadata changes rebuild the registration. Memoize large schemas and tool arrays to reduce comparison work.

The hook also retrieves tools exposed to the current document. It refreshes after native `toolchange` events. Call `refresh()` for an explicit read.

For retrieval only, call `useWebMCP({ fromOrigins })` without tool definitions. Inline `fromOrigins` arrays are safe; discovery restarts only when their values change.

## API

### `registerTool(tool, options?): () => void`

Register a single tool. Returns a cleanup function. No-op on unsupported browsers.

Native registration is asynchronous. The returned cleanup is synchronous and can abort registration before it finishes.

To register many at once, map and combine:

```ts
const cleanups = tools.map(registerTool);
const cleanup = () => cleanups.forEach((c) => c());
```

Use `exposedTo` to let descendant documents at specific origins discover the tool:

```ts
const cleanup = registerTool(tool, {
  exposedTo: ["https://agent.example"],
});
```

The SDK forwards the array with its own `AbortSignal`. The browser validates each origin. The wrapper logs validation failures without throwing.

The owning document does not need exposure. List only origins that need access.

### `getTools(options?): Promise<RegisteredTool[]>`

Discover tools exposed to the current document. The returned metadata is sorted by the browser and includes the registering `window` and `origin`. `inputSchema`, when present, is the browser's serialized JSON Schema string.

```ts
import { getTools } from "@web-ai-sdk/webmcp";

const sameOriginTools = await getTools();
const toolsAcrossFrames = await getTools({
  fromOrigins: ["https://agent.example"],
});
```

The browser includes eligible same-origin tools. `fromOrigins` also requests tools from listed secure origins. Those tools must expose themselves to the caller's origin.

Unsupported browsers return `[]`. Native permission, origin, and document-state errors reject the promise.

### `executeTool(tool, input?, options?): Promise<string | null>`

Execute a `RegisteredTool` returned by `getTools()`. Pass the JavaScript input value; the SDK serializes it to the JSON argument string expected by the browser.

```ts
import { executeTool, getTools } from "@web-ai-sdk/webmcp";

const tools = await getTools();
const echo = tools.find((tool) => tool.name === "echo_message");
if (echo) {
  const result = await executeTool(echo, { message: "hello" });
  console.log(result);
}
```

The native serialized string is returned unchanged. `null` means tool execution triggered a navigation. Pass `{ signal }` to cancel an in-flight call. Unsupported browsers reject with `WebMCPUnavailableError`.

`executeTool()` is experimental: Chrome [publicly documents it](https://developer.chrome.com/docs/ai/webmcp), but it is not yet present in the published WebMCP community-draft IDL.

### `subscribeToToolChanges(listener): () => void`

Listen for native `toolchange` events and return an idempotent cleanup function:

```ts
const unsubscribe = subscribeToToolChanges(() => {
  void getTools().then(renderTools);
});
```

On unsupported browsers, subscription and cleanup are no-ops.

### `RegisteredTool`

```ts
interface RegisteredTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: string;
  window: Window;
  origin: string;
  annotations?: ToolAnnotations;
}
```

### `isAvailable(): boolean`

Feature-detect helper.

### `Tool<TInput, TOutput>`

```ts
interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  title?: string; // human-readable host UI label
  description: string;
  inputSchema?: object; // JSON Schema
  readOnly?: boolean; // shorthand for annotations.readOnlyHint
  destructive?: boolean; // shorthand for annotations.destructiveHint
  annotations?: ToolAnnotations; // raw passthrough, merged on top
  execute: (input: TInput) => Promise<TOutput> | TOutput;
}
```

Plain `Tool` objects remain supported. Use `ToolDefinition` when declaring a
schema-aware tool separately from its registration call.

```ts
interface ToolDefinition<
  InputSchema extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
  OutputSchema extends StandardSchemaV1 | undefined = undefined,
> {
  name: string;
  title?: string;
  description: string;
  input?: InputSchema;
  output?: OutputSchema;
  inputSchema?: object;
  readOnly?: boolean;
  destructive?: boolean;
  annotations?: ToolAnnotations;
  execute: (
    input: InputSchema extends StandardSchemaV1
      ? StandardSchemaV1.InferOutput<InputSchema>
      : unknown,
  ) =>
    | Promise<
        OutputSchema extends StandardSchemaV1
          ? StandardSchemaV1.InferInput<OutputSchema>
          : TOutput
      >
    | (OutputSchema extends StandardSchemaV1
        ? StandardSchemaV1.InferInput<OutputSchema>
        : TOutput);
}
```

`title` is for human-facing host UI. `description` is consumed by the agent host; write it as an instruction to an LLM about when to call the tool.

The current WebMCP draft defines `readOnlyHint` and `untrustedContentHint`. The SDK also retains `destructiveHint`, `idempotentHint`, `openWorldHint`, and the `destructive` shorthand as source-compatible passthroughs for MCP-shaped and earlier WebMCP hosts; current-draft browsers may ignore those compatibility fields.

```ts
interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  destructiveHint?: boolean; // compatibility
  idempotentHint?: boolean; // compatibility
  openWorldHint?: boolean; // compatibility
}
```

### Standard Schema definitions

```ts
import { registerTool } from "@web-ai-sdk/webmcp";
import { z } from "zod";

const SendContactEmailInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subject: z.string().min(1),
  message: z.string().min(1),
});

const cleanup = registerTool({
  name: "send_contact_email",
  title: "Send contact email",
  description: "Send a contact email on behalf of the visitor.",
  destructive: true,
  // Standard Schema validates input before application code runs. execute
  // receives the schema's parsed or transformed output type.
  input: SendContactEmailInput,
  // Output schemas validate every resolved result and may transform it.
  output: z.object({ ok: z.literal(true) }),
  // Derive the browser-facing JSON Schema from the same source of truth.
  inputSchema: z.toJSONSchema(SendContactEmailInput, {
    io: "input",
    target: "draft-2020-12",
  }),
  async execute({ name, email, subject, message }) {
    // `name`, `email`, etc. are typed from the Zod schema.
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, subject, message }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  },
});
```

`registerTool` and `useWebMCP` accept any [Standard Schema](https://standardschema.dev) V1 validator (Zod 3.24+, Valibot, ArkType, Effect, …) directly, with no SDK dependency on a validation library. Heterogeneous readonly arrays are supported without casting them to `Tool[]`.

Standard Schema validation and [Standard JSON Schema](https://standardschema.dev/json-schema) conversion are orthogonal capabilities. The SDK keeps `inputSchema` explicit so consumers choose the converter and JSON Schema dialect. The example uses Zod 4's converter; other libraries can provide a Standard JSON Schema converter or pass an explicit JSON Schema object.

**Input validation:** supplying `input` validates before application code runs and passes the schema's parsed or transformed value to `execute`. Invalid input throws `ToolValidationError`; its `toolName` and `issues` fields identify the tool and preserve the Standard Schema issues.

**Output validation:** supplying `output` always validates the resolved sync or async `execute` result and returns the schema's parsed value, including transformations. Invalid output throws `ToolOutputValidationError`; its `toolName` and `issues` fields identify the tool and preserve the Standard Schema issues. The output schema is SDK-only because WebMCP has no `outputSchema` field.

Output validation only checks the rules encoded in the schema. It does not prove that a result is fresh, trustworthy, or factually correct.

The SDK-only `input` and `output` fields are never forwarded to the native
WebMCP host. `inputSchema`, metadata, annotations, and registration options keep
their native forwarding behavior.

### `defineTool({...}): Tool` — deprecated compatibility wrapper

`defineTool()` remains available for migration compatibility, including its
historical opt-in input validation through `validate: true`. New code should
pass schema-aware definitions directly to `registerTool()` or `useWebMCP()`.
The wrapper will only be removed in a documented breaking release.

## Safety

Set `annotations.untrustedContentHint: true` when results contain external, user-generated, or otherwise untrusted content. It is a trust-boundary signal for the host, not validation of the result's shape, truth, freshness, or safety.

The compatibility shorthand `destructive: true` still communicates mutating intent to hosts that understand `destructiveHint`, but an annotation is not authorization. Confirm consequential actions with the user and defend sensitive operations server-side with authentication, authorization, validation, origin controls, and rate limits.

## Troubleshooting

- **Inspector / agent doesn't see the tools.** The WebMCP entry point is per-document; each frame, including iframes, has its own `document.modelContext`. Tools registered inside an `<iframe>` are scoped to that frame and invisible to extensions hooked into the top page. Register from the top-level document, not from an embedded frame.

## License

MIT © Beto Muniz
