import os from "node:os";
import { commandName, runProcess } from "../process.ts";

describe("runProcess", () => {
  test("runs npm through the platform command wrapper", async () => {
    const result = await runProcess(commandName("npm"), ["--version"], {
      cwd: os.tmpdir(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
