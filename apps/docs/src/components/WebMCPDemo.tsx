import { type Tool, isWebMCPAvailable } from "@web-ai-sdk/webmcp";
import { useWebMCP } from "@web-ai-sdk/webmcp/react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface ListedTool {
  name: string;
  description: string;
  inputSchema: string;
}

interface ModelContextTesting {
  listTools(): ListedTool[];
  // Native Chrome serializes the result to a JSON string before returning.
  executeTool(name: string, input?: string): Promise<string>;
}

const getTesting = (): ModelContextTesting | undefined => {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as unknown as { modelContextTesting?: ModelContextTesting })
    .modelContextTesting;
};

export const WebMCPDemo = () => {
  const [log, setLog] = useState<string[]>([]);
  const [available, setAvailable] = useState<boolean>(() =>
    isWebMCPAvailable(),
  );
  const [echoInput, setEchoInput] = useState("hello world");

  // `useCallback` so the reference stays stable and the tools memo below
  // doesn't have to re-run on every render.
  const append = useCallback((line: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} ${line}`]);
  }, []);

  const tools = useMemo<Tool[]>(
    () => [
      {
        name: "list_demo_items",
        description:
          "List demo items. Use when the user asks for the demo catalog.",
        readOnly: true,
        execute: async () => {
          append("list_demo_items invoked");
          return { items: ["alpha", "beta", "gamma"] };
        },
      },
      {
        name: "echo_message",
        description: "Echo a message back. Demonstrates input schema.",
        readOnly: true,
        inputSchema: {
          type: "object",
          properties: {
            message: { type: "string", minLength: 1, maxLength: 200 },
          },
          required: ["message"],
        },
        execute: async (input) => {
          const { message } = input as { message: string };
          append(`echo_message called with "${message}"`);
          return { echoed: message };
        },
      },
    ],
    [append],
  );

  useWebMCP(tools);

  // The demo registers the `tools` array above via `useWebMCP`, so the
  // names displayed here are derived directly from what we register, with no
  // separate `listTools()` read. Avoids races between the registration effect
  // and a one-shot list read, and behaves identically whether this story
  // mounts inside the docs Canvas or as a standalone story.
  const registered = useMemo(() => tools.map((t) => t.name), [tools]);

  useEffect(() => {
    setAvailable(isWebMCPAvailable());
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
        Two tools registered against <code>navigator.modelContext</code>:{" "}
        <code>list_demo_items</code> (read-only) and <code>echo_message</code>{" "}
        (with input schema).
      </p>
      <p className="demo-muted">
        WebMCP available: <strong>{available ? "yes" : "no"}</strong>
      </p>
      {!available && (
        <p className="demo-hint">
          Enable <code>chrome://flags/#enable-webmcp-testing</code> in Chrome
          146+ and reload to exercise the tools.
        </p>
      )}
      <div className="demo-panel">
        <strong className="demo-panel__title">Registered tools</strong>
        {registered.length === 0 ? (
          <em className="demo-muted">(none)</em>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {registered.map((name) => (
              <li key={name}>
                <code>{name}</code>
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
