import { describe, expect, test, vi } from "vitest";
import type { SessionEvent } from "@github/copilot-sdk";
import { useAgentRunner } from "../copilot-sdk-runner.ts";
import { collectEvaluationAnswerBilling } from "../../skill-improvement/billing.ts";

const scenario = vi.hoisted(() => ({
  mode: "completed",
  listener: undefined as ((event: SessionEvent) => Promise<void>) | undefined,
}));

vi.mock("@github/copilot-sdk", () => ({
  CopilotClient: class {
    async createSession() {
      return {
        on: (listener: (event: SessionEvent) => Promise<void>) => { scenario.listener = listener; },
        send: async () => {
          await scenario.listener?.({
            id: "first-turn", timestamp: new Date().toISOString(), parentId: null,
            type: "assistant.turn_start", data: { turnId: "first" },
          });
          await scenario.listener?.({
            id: "usage", timestamp: new Date().toISOString(), parentId: "first-turn",
            type: "assistant.usage", ephemeral: true,
            data: { model: "test", copilotUsage: { totalNanoAiu: 1_250_000_000 } },
          });
          await scenario.listener?.({
            id: "turn", timestamp: new Date().toISOString(), parentId: "usage",
            type: "assistant.turn_start", data: { turnId: "second" },
          });
          if (scenario.mode !== "timeout") {
            await scenario.listener?.({
              id: "idle", timestamp: new Date().toISOString(), parentId: "turn",
              type: "session.idle", ephemeral: true, data: {},
            });
          }
        },
        abort: async () => {},
        disconnect: async () => {},
      };
    }
    async stop() {}
  },
  RuntimeConnection: { forStdio: () => ({}) },
  approveAll: () => {},
}));

vi.mock("../skill-loader.ts", () => ({
  DEFAULT_SKILL_CHAR_BUDGET: 1000,
  getSkillsForTest: async () => ({ skillsLoaded: [], skillDirectories: [], disabledSkills: [] }),
}));

describe("SDK answer billing completion", () => {
  test.each(["completed", "timeout", "max-turns", "early-termination"])(
    "propagates %s without treating earlier requests as complete", async mode => {
      scenario.mode = mode;
      const runner = useAgentRunner({ testName: "copilot-sdk-billing" });
      const metadata = await runner.run({
        prompt: "offline billing test",
        timeout: mode === "timeout" ? 10 : undefined,
        maxTurns: mode === "max-turns" ? 1 : undefined,
        shouldEarlyTerminate: mode === "early-termination"
          ? metadata => metadata.events.some(event => event.type === "assistant.usage")
          : undefined,
      });
      expect(metadata.completionStatus).toBe(mode === "completed" ? "completed" : "aborted");
      expect(collectEvaluationAnswerBilling(metadata.events, metadata.completionStatus === "completed"))
        .toMatchObject({
          usageEvents: 1, usageEventsWithBilling: 1,
          completeAiCredits: mode === "completed" ? 1.25 : null,
        });
    }
  );
});
