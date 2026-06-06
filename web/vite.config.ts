import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

// The dashboard is served by slipstream's own node:http server from
// dist/dashboard/web, so assets load with a relative base and the build emits
// into the dist tree the server already ships.
export default defineConfig({
  root: dir,
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(dir, "..", "dist", "dashboard", "web"),
    emptyOutDir: true
  }
});
