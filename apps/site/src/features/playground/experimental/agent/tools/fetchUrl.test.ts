import { afterEach, describe, expect, it, vi } from "vitest";
import { createFetchUrlTool } from "./fetchUrl.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createFetchUrlTool", () => {
  it("cancels a streamed response after reaching the byte limit", async () => {
    const encoder = new TextEncoder();
    let cancelled = false;
    let chunk = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          const value = ["12345", "67890"][chunk];
          chunk += 1;
          if (value) {
            controller.enqueue(encoder.encode(value));
          }
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(body, {
          headers: { "content-type": "text/plain" },
        });
      }),
    );

    const result = await createFetchUrlTool({ maxBytes: 5 }).execute(
      { url: "https://example.test/large.txt" },
      {
        signal: new AbortController().signal,
        callId: "fetch-1",
        step: 0,
        emit: vi.fn(),
      },
    );

    expect(result).toMatchObject({
      truncated: true,
      format: "text",
      text: "12345",
    });
    expect(cancelled).toBe(true);
  });

  it("drops JSON link fields but keeps url and html_url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          url: "https://api.example.test/repos/a/b",
          html_url: "https://example.test/a/b",
          forks_url: "https://api.example.test/repos/a/b/forks",
          git_refs_url: "https://api.example.test/repos/a/b/git/refs{/sha}",
          stargazers_count: 22,
          owner: {
            login: "a",
            avatar_url: "https://example.test/a.png",
          },
          topics: [{ name: "ai", tags_url: "https://example.test/t" }],
        }),
      ),
    );

    const result = await createFetchUrlTool().execute(
      { url: "https://api.example.test/repos/a/b" },
      {
        signal: new AbortController().signal,
        callId: "fetch-1",
        step: 0,
        emit: vi.fn(),
      },
    );

    expect(result).toMatchObject({ format: "json" });
    expect((result as { body: unknown }).body).toEqual({
      url: "https://api.example.test/repos/a/b",
      html_url: "https://example.test/a/b",
      stargazers_count: 22,
      owner: { login: "a" },
      topics: [{ name: "ai" }],
    });
  });

  it("decodes base64 text content and keeps binary content encoded", async () => {
    const readme =
      "# web-ai-sdk\n\nBuilding blocks for the Web AI surface. Olá!";
    const utf8Base64 = btoa(
      String.fromCharCode(...new TextEncoder().encode(readme)),
    );
    const binaryBase64 = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0));
    const responses = [
      // GitHub wraps base64 content at 60 characters.
      {
        content: `${utf8Base64.slice(0, 60)}\n${utf8Base64.slice(60)}`,
        encoding: "base64",
      },
      { content: binaryBase64, encoding: "base64" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(responses.shift())),
    );
    const tool = createFetchUrlTool();
    const ctx = {
      signal: new AbortController().signal,
      callId: "fetch-1",
      step: 0,
      emit: vi.fn(),
    };

    const text = await tool.execute(
      { url: "https://api.example.test/repos/a/b/readme" },
      ctx,
    );
    const binary = await tool.execute(
      { url: "https://api.example.test/repos/a/b/contents/logo.jpg" },
      ctx,
    );

    expect((text as { body: unknown }).body).toEqual({
      content: readme,
      encoding: "utf-8",
    });
    expect((binary as { body: unknown }).body).toEqual({
      content: binaryBase64,
      encoding: "base64",
    });
  });
});
