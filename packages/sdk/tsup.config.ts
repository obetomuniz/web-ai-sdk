import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    prompt: "src/prompt.ts",
    webmcp: "src/webmcp.ts",
    summarizer: "src/summarizer.ts",
    translator: "src/translator.ts",
    detector: "src/detector.ts",
    "react/prompt": "src/react/prompt.ts",
    "react/webmcp": "src/react/webmcp.ts",
    "react/summarizer": "src/react/summarizer.ts",
    "react/translator": "src/react/translator.ts",
    "react/detector": "src/react/detector.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // react is an optional peer dep; never bundle it.
  // The scoped @web-ai-sdk/* packages are runtime deps and must stay external
  // so this meta-package stays a thin re-export shell instead of duplicating
  // the wrappers' code.
  external: [
    "react",
    "@web-ai-sdk/prompt",
    "@web-ai-sdk/webmcp",
    "@web-ai-sdk/summarizer",
    "@web-ai-sdk/translator",
    "@web-ai-sdk/detector",
  ],
});
