import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("preserves helper resource, provenance, and workflow contracts", () => {
  const fixture = fileURLToPath(new URL("./helper_regressions.py", import.meta.url));
  const output = execFileSync(process.env.PYTHON ?? "python", ["-B", fixture], {
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, PYTHONNOUSERSITE: "1", PYTHONDONTWRITEBYTECODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  expect(output).toContain("Helper regressions passed");
});

it.each(["direct", "package"])("runs offline CLI orchestration in %s mode", (mode) => {
  const fixture = fileURLToPath(new URL("./cli_regressions.py", import.meta.url));
  expect(() => execFileSync(process.env.PYTHON ?? "python", ["-B", fixture], {
    encoding: "utf8",
    timeout: 120_000,
    env: {
      ...process.env,
      PYTHONNOUSERSITE: "1",
      PYTHONDONTWRITEBYTECODE: "1",
      FOUNDRY_IMPORT_MODE: mode,
    },
    stdio: ["ignore", "pipe", "pipe"],
  })).not.toThrow();
});
