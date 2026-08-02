import { defineTool, isAvailable, type Tool } from "@web-ai-sdk/webmcp";
import { useWebMCP } from "@web-ai-sdk/webmcp/react";
import { useEffect, useState } from "react";
import * as v from "valibot";
import { UnavailableHint } from "./UnavailableHint.js";

interface ModelContextTesting {
  // Native Chrome serializes the result to a JSON string before returning.
  executeTool(name: string, input?: string): Promise<string>;
}

const ListDemoItemsOutput = v.object({ items: v.array(v.string()) });
const EchoMessageInput = v.object({
  message: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
});
const EchoMessageOutput = v.object({ echoed: v.string() });

const getTesting = (): ModelContextTesting | undefined => {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as unknown as { modelContextTesting?: ModelContextTesting })
    .modelContextTesting;
};

export const WebMCPDemo = () => {
  const [log, setLog] = useState<string[]>([]);
  const [available, setAvailable] = useState<boolean>(() => isAvailable());
  const [echoInput, setEchoInput] = useState("hello world");

  const append = (line: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} ${line}`]);
  };

  // The hook compares discoverable metadata while keeping execute callbacks
  // current, so these definitions can read the latest render without a ref or
  // callback memoization bridge.
  const tools = [
    defineTool({
      name: "list_demo_items",
      title: "List demo items",
      description:
        "List demo items. Use when the user asks for the demo catalog.",
      readOnly: true,
      output: ListDemoItemsOutput,
      execute: async () => {
        append("list_demo_items invoked");
        return { items: ["alpha", "beta", "gamma"] };
      },
    }),
    defineTool({
      name: "echo_message",
      title: "Echo a message",
      description: "Echo a message back. Demonstrates input schema.",
      readOnly: true,
      input: EchoMessageInput,
      validate: true,
      output: EchoMessageOutput,
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string", minLength: 1, maxLength: 200 },
        },
        required: ["message"],
        additionalProperties: false,
      },
      execute: async ({ message }) => {
        append(`echo_message called with "${message}"`);
        return { echoed: message };
      },
    }),
  ] as unknown as Tool[];

  useWebMCP(tools);

  // The demo registers the `tools` array above via `useWebMCP`, so the
  // names displayed here are derived directly from what we register, with no
  // separate `listTools()` read. Avoids races between the registration effect
  // and a one-shot list read, and behaves identically whether this story
  // mounts inside the docs Canvas or as a standalone story.
  const registered = tools.map(({ name, title }) => ({ name, title }));

  useEffect(() => {
    setAvailable(isAvailable());
  }, []);

  const invoke = async (name: string, input?: string) => {
    const testing = getTesting();
    if (!testing) {
      append(`(no testing surface; cannot invoke ${name})`);
      return;
    }
    try {
      const raw = await testing.executeTool(name, input);
      // executeTool returns a JSON string; re-parse so the rendered output is
      // human-readable instead of double-encoded.
      let pretty: string;
      try {
        pretty = JSON.stringify(JSON.parse(raw));
      } catch {
        pretty = String(raw);
      }
      append(`→ result: ${pretty}`);
    } catch (err) {
      append(`× error: ${(err as Error)?.message ?? String(err)}`);
    }
  };

  return (
    <div className="demo-card demo-card--narrow">
      <p className="demo-muted">
        Two titled, read-only tools registered against{" "}
        <code>document.modelContext</code>. The echo tool validates its input,
        and both tools validate their output.
      </p>
      <p className="demo-muted">
        WebMCP available: <strong>{available ? "yes" : "no"}</strong>
      </p>
      {!available && (
        <UnavailableHint
          api="WebMCP"
          chrome={
            <>
              Enable <code>chrome://flags/#enable-webmcp-testing</code> in
              Chrome 146+ and reload to exercise the tools.
            </>
          }
          edge={
            <>
              Enable <code>edge://flags/#enable-webmcp-testing</code> in Edge
              147+ and reload to exercise the tools.
            </>
          }
        />
      )}
      <div className="demo-panel">
        <strong className="demo-panel__title">Registered tools</strong>
        {registered.length === 0 ? (
          <em className="demo-muted">(none)</em>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {registered.map(({ name, title }) => (
              <li key={name}>
                {title}: <code>{name}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="demo-panel">
        <strong className="demo-panel__title">Invoke</strong>
        <div className="demo-row">
          <button
            type="button"
            disabled={!getTesting()}
            onClick={() => invoke("list_demo_items", "{}")}
            className="demo-button demo-button--small"
          >
            list_demo_items
          </button>
        </div>
        <div className="demo-row">
          <input
            value={echoInput}
            onChange={(e) => setEchoInput(e.target.value)}
            className="demo-input"
            aria-label="message to echo"
          />
          <button
            type="button"
            disabled={!getTesting()}
            onClick={() =>
              invoke("echo_message", JSON.stringify({ message: echoInput }))
            }
            className="demo-button demo-button--small"
          >
            echo_message
          </button>
        </div>
      </div>
      <div className="demo-log">
        {log.length === 0 ? (
          <em className="demo-log__empty">
            (no invocations yet. Click an Invoke button.)
          </em>
        ) : (
          log.map((line) => <div key={line}>{line}</div>)
        )}
      </div>
    </div>
  );
};
