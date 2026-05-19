import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Base path defaults to `/` for the custom-domain deploy (web-ai-sdk.dev).
// Override at build time with VITE_BASE=/web-ai-sdk/ for project Pages hosting
// or any other prefix.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
