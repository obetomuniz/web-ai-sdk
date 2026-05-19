import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Base path for GitHub Pages deployment under /web-ai-sdk/.
// Override at build time with VITE_BASE=/ for root-domain hosting.
const base = process.env.VITE_BASE ?? "/web-ai-sdk/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
