import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws outside a React Server Components bundle.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Tests must never reach live market data APIs.
    env: { FINNHUB_API_KEY: "", SEC_USER_AGENT: "", QUOTE_PROVIDER: "finnhub", RATES_PROVIDER: "none", FUNDAMENTALS_PROVIDER: "sec" },
    coverage: { provider: "v8", include: ["lib/**/*.ts"] },
  },
});
