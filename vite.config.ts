import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // expose engine directly without the RN native wrappers
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
