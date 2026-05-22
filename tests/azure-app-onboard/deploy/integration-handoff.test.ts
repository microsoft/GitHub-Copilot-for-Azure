/**
 * Integration Tests — Handoff Phase (Step 10)
 *
 * Validates post-deploy handoff: cleanup commands, deployment identity,
 * and post-deploy recommendations.
 *
 * Uses seedDeployReadyWorkspace to skip prereq/prepare/scaffold (~20 min savings).
 * Extracted from integration-pipeline-flow.test.ts — deploy-phase specific.
 */

import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
} from "../../utils/evaluate";
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  DEPLOY_PHASE_PROMPT,
  DEPLOY_PHASE_FOLLOW_UPS,
  shouldEarlyTerminateOnHandoff,
  assertHandoffPresented,
  assertSessionFileCreated,
  assertPhaseArtifactsExist,
  assertDeployChecklistExists,
  assertDeployPreflightSubagentDispatched,
  assertNoSubagentFailures,
  hasReachedDeployPhase,
  seedDeployReadyWorkspace,
} from "../app-onboard-test-helpers";

describeAppOnboardWithCleanup("Handoff Tests", (agent) => {
  describe("handoff-phase", () => {
    test("handoff presents cleanup, identity, and recommendations after deploy", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            seedDeployReadyWorkspace(workspace);
          },
          prompt: DEPLOY_PHASE_PROMPT,
          followUp: DEPLOY_PHASE_FOLLOW_UPS,
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 1_800_000, // 30 min per follow-up
          shouldEarlyTerminate: shouldEarlyTerminateOnHandoff,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // ROOT CAUSE GUARD: check deploy-checklist.md first
        if (workspacePath) {
          assertDeployChecklistExists(agentMetadata, workspacePath);
        }

        // Must present handoff content
        assertHandoffPresented(agentMetadata);

        // Sub-agent assertions: deploy preflight must be dispatched via task tool
        // Only assert when deploy phase was actually reached — if pipeline stalled in
        // prereq/prepare/scaffold, the deploy sub-agent was never expected to fire.
        if (hasReachedDeployPhase(agentMetadata)) {
          assertDeployPreflightSubagentDispatched(agentMetadata);
        } else {
          agentMetadata.testComments.push("⚠️ DEPLOY PHASE NOT REACHED: Skipping deploy sub-agent assertion");
        }
        assertNoSubagentFailures(agentMetadata);

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
    }, 3000000); // 50 min — seeded fixture, deploy through handoff
  });
});
