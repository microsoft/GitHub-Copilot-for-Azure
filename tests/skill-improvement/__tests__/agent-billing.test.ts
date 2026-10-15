import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { runImprovementAgent } from "../engine.ts";
import { loadRunSpec } from "../config.ts";
import { runProcess } from "../process.ts";
import type { ComponentBilling } from "../billing.ts";

vi.mock("../process.ts", async importOriginal => ({
  ...await importOriginal<typeof import("../process.ts")>(),
  runProcess: vi.fn(),
}));

describe("improvement-agent consumption collection", () => {
  test.each(["success", "failed-finalized", "timeout", "missing-usage"] as const)(
    "records one invocation and preserves process failures: %s", async outcome => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-billing-"));
      const spec = loadRunSpec(path.resolve("skill-improvement", "specs", "azure-kusto.yaml"), {
        AZURE_EVALS_SUBSCRIPTION_ID: "subscription",
        AZURE_EVALS_RESOURCE_GROUP: "resource-group",
      });
      const skillRoot = path.join(root, "plugins", spec.target.plugin, "skills", spec.target.skill);
      fs.mkdirSync(skillRoot, { recursive: true });
      const packet = path.join(root, "failure.md");
      fs.writeFileSync(packet, "failure evidence");
      const usageFile = path.join(root, "iteration-1-agent-usage.json");
      fs.writeFileSync(usageFile, JSON.stringify({ totalNanoAiu: 99_000_000_000, aiCreditsStatus: "complete" }));
      const eventFile = path.join(root, "iteration-1-agent.jsonl");
      fs.writeFileSync(eventFile, JSON.stringify({ type: "result", exitCode: 0 }));
      const error = new Error(outcome === "timeout" ? "Timed out" : "Agent failed");
      let captured: ComponentBilling | undefined;
      vi.mocked(runProcess).mockImplementation(async (_command, args, options) => {
        expect(args).toContain("--usage-output-file");
        if (outcome !== "missing-usage") {
          fs.writeFileSync(usageFile, JSON.stringify({
            totalNanoAiu: 2_500_000_000, aiCreditsStatus: "complete",
          }), { flag: "wx" });
        }
        if (outcome !== "timeout") {
          fs.writeFileSync(options.stdoutFile!, JSON.stringify({
            type: "result", exitCode: outcome === "failed-finalized" ? 1 : 0,
          }) + "\n", { flag: "wx" });
        }
        if (outcome === "failed-finalized" || outcome === "timeout") {
          throw error;
        }
        return { exitCode: 0, stdout: "", stderr: "" };
      });
      try {
        const pending = runImprovementAgent(
          root, root, spec, packet, undefined, 1, Date.now() + 60_000,
          billing => { captured = billing; }
        );
        if (outcome === "failed-finalized" || outcome === "timeout") {
          await expect(pending).rejects.toBe(error);
        } else {
          await pending;
        }
        if (outcome === "missing-usage") {
          expect(fs.existsSync(usageFile)).toBe(false);
        }
        if (outcome === "timeout") {
          expect(fs.existsSync(eventFile)).toBe(false);
        }
        const complete = outcome === "success" || outcome === "failed-finalized";
        expect(captured).toMatchObject({
          expected: 1, observed: 1, measured: complete ? 1 : 0,
          measuredAiCredits: complete ? 2.5 : 0,
        });
        expect(fs.existsSync(path.join(skillRoot, ".skill-improvement-failure-packet.md"))).toBe(false);
      } finally {
        vi.mocked(runProcess).mockReset();
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
