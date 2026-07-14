/**
 * Incremental JSONL line buffer for streaming A2UI from model tokens.
 */
export class A2uiJsonlBuffer {
  private pending = "";

  /** Append a chunk and return any newly completed non-empty lines. */
  feed(chunk: string): string[] {
    this.pending += chunk;
    const lines: string[] = [];
    for (;;) {
      const nl = this.pending.indexOf("\n");
      if (nl === -1) break;
      const line = this.pending.slice(0, nl).trim();
      this.pending = this.pending.slice(nl + 1);
      if (line) lines.push(line);
    }
    return lines;
  }

  /** Flush the trailing line when the stream ends (no trailing newline). */
  flush(): string[] {
    const line = this.pending.trim();
    this.pending = "";
    return line ? [line] : [];
  }
}
