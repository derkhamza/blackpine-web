import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { readFileSync } from "fs";

// Expose the package version to the app (shown on the owner Admin screen so a
// tester/admin can tell which build is live — see DEPLOY.md rollback runbook).
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Adds the web-push `push` / `notificationclick` handlers to the generated
        // SW without leaving the generateSW strategy (keeps offline + autoUpdate).
        importScripts: ["/push-sw.js"],
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
        name: "Blackpine",
        short_name: "Blackpine",
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
    // Production source maps are the single biggest chunk of build CPU/memory on
    // Vercel (a ~4 MB map for a ~1.7 MB bundle). No map-consuming error tracker is
    // wired up, so skip them in prod builds — flip back to true only when actively
    // debugging a minified prod stack trace.
    sourcemap: false,
    rollupOptions: {
      // Suppress "not exported by" warnings that come from type-only re-exports
      // in the engine's internal files. They're TypeScript types stripped at
      // build time — no actual missing values at runtime.
      onwarn(warning, defaultHandler) {
        if (warning.code === "MISSING_EXPORT") return;
        defaultHandler(warning);
      },
      output: {
        // Split third-party dependencies into one long-lived vendor chunk, out of
        // the app chunk. It minifies with less peak memory and caches across deploys
        // (an app change no longer re-downloads React/i18n/etc). A single vendor
        // chunk avoids the inter-vendor circular-chunk edges a finer split creates.
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
});
