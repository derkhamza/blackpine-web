import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests for the pure logic libraries (billing, eGFR, growth reference,
// document layout, appointment-type registry). These run in a Node environment
// (no DOM) and must stay fast + deterministic — no network, no timers.
export default defineConfig({
  resolve: {
    alias: {
      "blackpine-engine": path.resolve(__dirname, "../blackpine-app/packages/engine/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
    reporters: ["default"],
  },
});
