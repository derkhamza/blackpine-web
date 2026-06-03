import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Point directly at the TypeScript source so Vite never tries to
    // pre-bundle the engine via its node_modules entry (which has
    // "type":"commonjs" but ESM source, causing a silent blank-page crash).
    alias: {
      "blackpine-engine": path.resolve(
        __dirname,
        "../blackpine-app/packages/engine/src/index.ts"
      ),
    },
  },
  optimizeDeps: {
    // Engine is resolved via alias above — exclude it from esbuild pre-bundling
    exclude: ["blackpine-engine"],
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      // Suppress "not exported by" warnings that come from type-only re-exports
      // in the engine's internal files. They're TypeScript types stripped at
      // build time — no actual missing values at runtime.
      onwarn(warning, defaultHandler) {
        if (warning.code === "MISSING_EXPORT") return;
        defaultHandler(warning);
      },
    },
  },
});
