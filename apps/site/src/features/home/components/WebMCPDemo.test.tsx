// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebMCPDemo } from "./WebMCPDemo.js";

const mocks = vi.hoisted(() => {
  const tools = [
    {
      name: "get_web_ai_sdk_resources",
      description: "List SDK resources",
    },
    { name: "add_to_cart", description: "Add a SKU to the cart" },
    { name: "search_orders", description: "Search past orders" },
  ];

  return {
    ask: vi.fn(async (_options: { input: string }) => ({ output: "" })),
    executeTool: vi.fn(async () => '{"ok":true}'),
    prepareLanguageModel: vi.fn(() => ({
      ready: Promise.resolve(),
      release: vi.fn(),
    })),
    promptAvailable: false,
    refresh: vi.fn(async () => tools),
    tools,
  };
});

vi.mock("@web-ai-sdk/prompt", () => ({
  ask: mocks.ask,
  isAvailable: () => mocks.promptAvailable,
  PromptUnavailableError: class PromptUnavailableError extends Error {},
  prepareLanguageModel: mocks.prepareLanguageModel,
}));

vi.mock("@web-ai-sdk/webmcp", () => ({
  executeTool: mocks.executeTool,
  getTools: vi.fn(async () => mocks.tools),
  isAvailable: () => true,
}));

vi.mock("@web-ai-sdk/webmcp/react", () => ({
  useWebMCP: () => ({
    tools: mocks.tools,
    status: "ready",
    error: null,
    refresh: mocks.refresh,
  }),
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  mocks.ask.mockClear();
  mocks.executeTool.mockClear();
  mocks.prepareLanguageModel.mockClear();
  mocks.promptAvailable = false;
  mocks.refresh.mockClear();
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("WebMCPDemo", () => {
  it("reports the complete discovery count and executes schema-valid cart arguments", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(<WebMCPDemo />));

    expect(container.textContent).toContain("2 demo tools registered");

    const runButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Run agent"),
    );
    expect(runButton).toBeDefined();

    await act(async () => {
      runButton?.click();
      await vi.runAllTimersAsync();
    });

    expect(container.textContent).toContain(
      "getTools() → 3 tools (2 in this demo)",
    );
    expect(mocks.executeTool).toHaveBeenCalledWith(mocks.tools[1], {
      sku: "MX-200",
      quantity: 2,
    });
  });

  it("gives the on-device router the registered input schema", async () => {
    mocks.promptAvailable = true;
    mocks.ask.mockResolvedValue({
      output:
        '{"tool":"add_to_cart","args":{"sku":"MX-200","quantity":2},"reason":"Add the requested item."}',
    });
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(<WebMCPDemo />));
    const runButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Run agent"),
    );

    await act(async () => {
      runButton?.click();
      await vi.runAllTimersAsync();
    });

    const request = mocks.ask.mock.calls[0]?.[0] as
      | { input: string; responseConstraint?: object }
      | undefined;
    expect(request?.input).toContain("input schema:");
    expect(request?.input).toContain('"quantity"');
    expect(mocks.executeTool).toHaveBeenCalledWith(mocks.tools[1], {
      sku: "MX-200",
      quantity: 2,
    });
  });

  it("constrains the router response and parses it without scraping", async () => {
    mocks.promptAvailable = true;
    mocks.ask.mockResolvedValue({
      output:
        '{"tool":"add_to_cart","args":{"sku":"MX-200","quantity":2},"reason":"Add the requested item."}',
    });
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(<WebMCPDemo />));
    const runButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Run agent"),
    );

    await act(async () => {
      runButton?.click();
      await vi.runAllTimersAsync();
    });

    const request = mocks.ask.mock.calls[0]?.[0] as {
      responseConstraint?: { properties?: Record<string, unknown> };
    };
    expect(request.responseConstraint).toBeDefined();
    expect(request.responseConstraint?.properties).toHaveProperty("tool");
    expect(request.responseConstraint?.properties).toHaveProperty("reason");
    expect(mocks.executeTool).toHaveBeenCalledWith(mocks.tools[1], {
      sku: "MX-200",
      quantity: 2,
    });
  });

  it("refuses when the model names a tool outside the registered set", async () => {
    mocks.promptAvailable = true;
    mocks.ask.mockResolvedValue({
      output: '{"tool":"delete_account","args":{},"reason":"Best match."}',
    });
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(<WebMCPDemo />));
    const runButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Run agent"),
    );

    await act(async () => {
      runButton?.click();
      await vi.runAllTimersAsync();
    });

    expect(container.textContent).toContain(
      `LM picked "delete_account" which isn't registered`,
    );
    expect(mocks.executeTool).not.toHaveBeenCalled();
  });

  it("refuses when the model's arguments fail the tool's input schema", async () => {
    mocks.promptAvailable = true;
    mocks.ask.mockResolvedValue({
      output: '{"tool":"add_to_cart","args":{"quantity":0},"reason":"Add it."}',
    });
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(<WebMCPDemo />));
    const runButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Run agent"),
    );

    await act(async () => {
      runButton?.click();
      await vi.runAllTimersAsync();
    });

    expect(container.textContent).toContain("failed schema validation");
    expect(mocks.executeTool).not.toHaveBeenCalled();
  });

  it("prepares the routing session only after tab intent", async () => {
    mocks.promptAvailable = true;
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(<WebMCPDemo />));
    expect(mocks.prepareLanguageModel).not.toHaveBeenCalled();

    act(() => root?.render(<WebMCPDemo intent />));
    expect(mocks.prepareLanguageModel).toHaveBeenCalledTimes(1);
  });
});
