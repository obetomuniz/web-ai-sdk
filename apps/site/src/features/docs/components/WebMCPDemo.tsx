import {
  executeTool,
  isAvailable,
  type ToolDefinition,
} from "@web-ai-sdk/webmcp";
import { useWebMCP } from "@web-ai-sdk/webmcp/react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { UnavailableHint } from "./UnavailableHint.js";

const ListDemoItemsOutput = z.object({ items: z.array(z.string()) });
const EchoMessageInput = z.strictObject({
  message: z.string().min(1).max(200),
});
const EchoMessageOutput = z.object({ echoed: z.string() });

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
    {
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
    } satisfies ToolDefinition<undefined, unknown, typeof ListDemoItemsOutput>,
    {
      name: "echo_message",
      title: "Echo a message",
      description: "Echo a message back. Demonstrates input schema.",
      readOnly: true,
      input: EchoMessageInput,
      output: EchoMessageOutput,
      inputSchema: z.toJSONSchema(EchoMessageInput, {
        io: "input",
        target: "draft-2020-12",
      }),
      execute: async ({ message }) => {
        append(`echo_message called with "${message}"`);
        return { echoed: message };
      },
    } satisfies ToolDefinition<
      typeof EchoMessageInput,
      unknown,
      typeof EchoMessageOutput
    >,
  ] as const;

  const { tools: discovered, status, error } = useWebMCP(tools);
  const registered = discovered.filter((tool) =>
    tools.some((candidate) => candidate.name === tool.name),
  );

  useEffect(() => {
    setAvailable(isAvailable());
  }, []);

  const invoke = async (name: string, input: unknown = {}) => {
    const tool = registered.find((candidate) => candidate.name === name);
    if (!tool) {
      append(`(tool is not registered; cannot invoke ${name})`);
      return;
    }
    try {
      const raw = await executeTool(tool, input);
      // executeTool returns a JSON string; re-parse so the rendered output is
      // human-readable instead of double-encoded.
      let pretty: string;
      if (raw === null) {
        pretty = "navigation triggered";
      } else {
        try {
          pretty = JSON.stringify(JSON.parse(raw));
        } catch {
          pretty = raw;
        }
      }
      append(`result: ${pretty}`);
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
      {error && <p className="demo-muted">Discovery error: {error.message}</p>}
      {!available && (
        <UnavailableHint
          api="WebMCP"
          chrome={
            <>
              Enable <code>chrome://flags/#enable-webmcp-testing</code> for
              local Chrome development, or use the Chrome origin trial from 149.
            </>
          }
          edge={
            <>
              Microsoft lists WebMCP in the Edge 150 origin trials. Register an
              origin-trial token to exercise the tools.
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
            disabled={status !== "ready"}
            onClick={() => invoke("list_demo_items")}
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
            disabled={status !== "ready"}
            onClick={() => invoke("echo_message", { message: echoInput })}
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
