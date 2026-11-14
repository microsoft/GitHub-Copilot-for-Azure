import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

// Runs the imported source Python unittest suite (offline instruction, fixture
// and helper-script contracts) for the observability-super-skill plugin.
it("passes the observability-super-skill Python contract tests", () => {
  const directory = fileURLToPath(new URL(".", import.meta.url));
  expect(() => execFileSync(
    process.env.PYTHON ?? "python",
    ["-B", "-m", "unittest", "discover", "-s", directory, "-p", "test_*.py"],
    {
      encoding: "utf8",
      timeout: 600_000,
      env: { ...process.env, PYTHONNOUSERSITE: "1", PYTHONDONTWRITEBYTECODE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )).not.toThrow();
});
