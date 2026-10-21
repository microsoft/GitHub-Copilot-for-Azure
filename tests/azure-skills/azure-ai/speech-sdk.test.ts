import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("preserves the built Speech SDK analyzer's evidence and privacy contracts", () => {
  const regressions = fileURLToPath(new URL("./speech-sdk-regressions.mjs", import.meta.url));
  const output = execFileSync(process.execPath, ["--test", "--test-reporter=tap", regressions], {
    encoding: "utf8",
    timeout: 120_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  expect(output).toMatch(/# fail 0\b/);
});
