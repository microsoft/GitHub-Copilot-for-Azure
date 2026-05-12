/**
 * Integration Tests — Handoff Phase (Step 10)
 *
 * Validates post-deploy handoff: cleanup commands, deployment identity,
 * and post-deploy recommendations.
 *
 * Extracted from integration-pipeline-flow.test.ts — deploy-phase specific.
 */

import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  shouldEarlyTerminateOnHandoff,
  assertHandoffPresented,
  assertSessionFileCreated,
  assertPhaseArtifactsExist,
} from "../app-onboard-test-helpers";

describeAppOnboardWithCleanup("Handoff Tests", (agent) => {
  describe("handoff-phase", () => {
    test("handoff presents cleanup, identity, and recommendations after deploy", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I built a side project and want to get it live on Azure",
          followUp: [
            "Just go with defaults, cheapest option.",
            "Yes, proceed with scaffolding.",
            "Yes, deploy to Azure now.",
            "Yes, confirm the deployment.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 1_800_000, // 30 min per follow-up
          shouldEarlyTerminate: shouldEarlyTerminateOnHandoff,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Must present handoff content
        assertHandoffPresented(agentMetadata);

        // Session integrity
        if (workspacePath) {
          assertSessionFileCreated(agentMetadata, workspacePath);
          assertPhaseArtifactsExist(agentMetadata, workspacePath, [
            "context.json",
            "prereq-output.json",
            "prepare-plan.json",
          ]);
        }
      });
    }, 3600000); // 60 min — full pipeline through handoff
  });
});
