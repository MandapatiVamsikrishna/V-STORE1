import { defineConfig, createLogger } from "vite";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "client");

// Every .html file in /client is its own page (multi-page app)
const input = Object.fromEntries(
  readdirSync(root)
    .filter((f) => f.endsWith(".html"))
    .map((f) => [f.replace(/\.html$/, ""), resolve(root, f)])
);

// The storefront uses plain (non-module) scripts from client/public on purpose;
// hide Vite's "can't be bundled without type=module" notice for them.
const logger = createLogger();
const warn = logger.warn;
logger.warn = (msg, opts) => { if (!msg.includes("can't be bundled without type")) warn(msg, opts); };

export default defineConfig({
  customLogger: logger,
  root,
  // "./" keeps links working on GitHub Pages sub-paths too
  base: "./",
  server: {
    port: 5173,
    open: true,
    proxy: { "^/api/": "http://localhost:5000" } // only /api/... (not /api.js)
  },
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: { input }
  }
});
