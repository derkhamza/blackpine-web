import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/blackpine-backend\.vercel\.app\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      manifest: {
        name: "Iyadaty",
        short_name: "Iyadaty",
        description: "Gestion de cabinet médical — agenda, patients, finances",
        theme_color: "#1E3A2F",
        background_color: "#F5F4EF",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        lang: "fr",
        icons: [
          { src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
        ],
        categories: ["medical", "productivity"],
      },
    }),
  ],
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
