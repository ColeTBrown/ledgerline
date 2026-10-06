import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Tests must never reach live market data APIs.
    env: { FINNHUB_API_KEY: "", SEC_USER_AGENT: "" },
    coverage: { provider: "v8", include: ["lib/**/*.ts"] },
  },
});
