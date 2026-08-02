# @web-ai-sdk/webmcp

web-ai-sdk building block for the W3C [WebMCP](https://webmachinelearning.github.io/webmcp/) API exposed at `document.modelContext`. (For backward compatibility with the previous shape of the API, this package also reads from `navigator.modelContext`.)

An ergonomic, framework-agnostic adapter over the native browser API, with safe register/unregister cleanup and a feature-detected no-op fallback for non-supporting browsers.

**Docs:** <https://web-ai-sdk.dev/docs/guides/webmcp/> · **React:** [`useWebMCP`](https://web-ai-sdk.dev/docs/react/use-web-mcp/)

## Status

WebMCP shipped as an early preview in Chrome 146+ behind `chrome://flags/#enable-webmcp-testing`; a public [origin trial](https://developer.chrome.com/docs/ai/webmcp) opens in Chrome 149. Edge added support in 147+ behind the matching `edge://flags/` toggle. On any browser that doesn't expose `document.modelContext` (or the legacy `navigator.modelContext`), this library is a no-op. Your app stays callable, and no tools get registered. A WebMCP spec update changed `registerTool` to return a Promise (cross-origin iframe tool sharing made registration asynchronous); this adapter normalizes both the legacy synchronous shape and the async shape, so consumer code is unchanged.

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
  useWebMCP(
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
  return null;
}
```

The hook accepts one tool or a readonly array. It registers on mount, unregisters on unmount, and cleans up immediately when `enabled` changes to `false`. Registration follows discoverable metadata and `exposedTo` values rather than object identity, while `execute` always uses the latest committed callback. Inline tool objects, arrays, and options are safe: changing React state alone does not rebuild the registration, but changing a tool's name, title, description, schema, annotations, or exposure does. Memoize tool arrays and large schemas when practical to avoid rebuilding and comparing their metadata on every render; correctness does not depend on memoization.

## API

### `registerTool(tool, options?): () => void`

Register a single tool. Returns a cleanup function. No-op on unsupported browsers.

Registration is asynchronous under the hood (per the current spec); the returned cleanup is synchronous and safe to call before registration settles — it aborts the in-flight registration cleanly.

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

The SDK forwards the array unchanged alongside its internally owned `AbortSignal`. The browser validates each origin and rejects invalid or untrustworthy values; the wrapper preserves its non-throwing registration posture and logs that failure. Exposure is unnecessary for the owning document and should be limited to origins that genuinely need access.

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

`title` is for human-facing host UI. `description` is consumed by the agent host (Cursor / Claude / Chrome agent / etc.); write it as an instruction to an LLM about when to call the tool.

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
