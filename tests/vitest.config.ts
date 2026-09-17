import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.{js,ts}"],
    exclude: ["**/node_modules/**", "**/_template/**", "**/dist/**"],
    testTimeout: 20 * 60 * 1000,
    clearMocks: true,
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./reports/junit.xml",
    },
    coverage: {
      provider: "v8",
      include: ["../output/*/skills/**/*.{js,ts}"],
      exclude: ["**/node_modules/**", "**/_template/**"],
      reportsDirectory: "./coverage",
      reporter: ["text", "text-summary", "html", "json-summary"],
    },
  },
});