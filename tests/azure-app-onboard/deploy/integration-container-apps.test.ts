/**
 * Integration Tests — Container Apps Code Deploy
 *
 * Validates that azure-app-onboard deploys code to Container Apps end-to-end,
 * not just IaC with placeholder images + manual "Next Steps."
 *
 * Tests that Container Apps code deploy executes ACR builds instead of
 * presenting manual CLI commands.
 *
 * Uses wetty (butlerx/wetty): single-component TypeScript/Express app with
 * Dockerfile. Simple repo avoids monorepo exploration loops that caused
 * chronic flaky failures with fullstack-starter.
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getAllAssistantMessages,
  getToolCalls,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  SKILL_NAME,
  integrationTestTimeoutMs,
  shouldEarlyTerminateOnContainerAppsCodeDeploy,
  assertSessionFileCreated,
  cleanupSessionResourceGroups,
  assertAgentScannedWorkspace,
  assertDeployPreflightSubagentDispatched,
  assertScaffoldSubagentsDispatched,
  assertNoSubagentFailures,
  hasReachedScaffoldPhase,
  hasReachedDeployPhase,
  SUBSCRIPTION_PRIMER,
} from "../app-onboard-test-helpers";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Container Apps Deploy`, () => {
  const _agent = useAgentRunner();
  let lastMetadata: import("../../utils/agent-runner").AgentMetadata | undefined;
  afterEach(() => { if (lastMetadata) { cleanupSessionResourceGroups(lastMetadata); lastMetadata = undefined; } });
  const agent = { run: async (...args: Parameters<typeof _agent.run>) => { const m = await _agent.run(...args); lastMetadata = m; return m; } };

  describe("container-apps-deploy", () => {
    test("e2e — wetty deploys code to Container Apps, not just IaC", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/butlerx/wetty",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I want to take my local app and put it in the cloud — where do I start?",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 2_400_000, // 40 min — single-container app is much faster than monorepo
          shouldEarlyTerminate: shouldEarlyTerminateOnContainerAppsCodeDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        // Must invoke azure-app-onboard
        const skillInvoked = isSkillInvoked(agentMetadata, SKILL_NAME);
        setSkillInvocationRate(skillInvoked ? 1 : 0);
        expect(skillInvoked).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // HARD: Must NOT present manual CLI commands as "Next Steps" for code deploy
        const hasManualDeploySteps =
          /next steps.{0,100}(docker build|docker push|deploy your code|az containerapp update)/i.test(messages);
        if (hasManualDeploySteps) {
          agentMetadata.testComments.push(
            "❌ Agent presented manual 'Next Steps' for code deploy instead of executing ACR builds"
          );
        }
        expect(hasManualDeploySteps).toBe(false);

        // HARD: Must mention or execute ACR build — this test validates code deploy, not just IaC
        // Check both assistant messages AND tool calls (agent may execute builds via tools without mentioning in text)
        const mentionsAcrBuild =
          /az acr build|acr.{0,20}build|container.{0,20}registry.{0,20}build|image.{0,20}(build|push)/i.test(messages);
        const toolCalls = getToolCalls(agentMetadata);
        const executedAcrBuild = toolCalls.some(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          if (toolName !== "powershell" && toolName !== "bash" && toolName !== "run_in_terminal") return false;
          const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
          return /az\s+acr\s+build|docker\s+(build|push)|acr.*build/.test(cmd);
        });
        if (!mentionsAcrBuild && !executedAcrBuild) {
          agentMetadata.testComments.push(
            "❌ Agent did not execute or mention ACR image builds — code deploy phase not reached"
          );
        }
        expect(mentionsAcrBuild || executedAcrBuild).toBe(true);

        // HARD: Must identify Container Apps as the target compute
        const mentionsContainerApps = /container.?apps/i.test(messages);
        if (!mentionsContainerApps) {
          agentMetadata.testComments.push("❌ Agent did not mention Container Apps");
        }
        expect(mentionsContainerApps).toBe(true);

        // HARD: Must use Bicep, NOT Terraform — Bicep is the default IaC format
        const usedTerraform = /terraform\s+(init|plan|apply)|hashicorp\/azurerm/i.test(messages);
        if (usedTerraform) {
          agentMetadata.testComments.push(
            "❌ Agent used Terraform instead of Bicep — follow-up explicitly requests Bicep"
          );
        }
        expect(usedTerraform).toBe(false);

        const mentionsBicep = /bicep|\.bicep|az deployment (sub|group) create/i.test(messages);
        if (!mentionsBicep) {
          agentMetadata.testComments.push(
            "❌ Agent did not mention Bicep or az deployment — expected Bicep scaffold flow"
          );
        }
        expect(mentionsBicep).toBe(true);

        // Must scan workspace
        assertAgentScannedWorkspace(agentMetadata);

        // HARD: Must NOT use azd up/deploy — AppOnboard deploys via az deployment sub create
        const usedAzd = /azd\s+(up|provision|deploy)/i.test(messages);
        if (usedAzd) {
          agentMetadata.testComments.push(
            "❌ Agent used azd up/provision/deploy — AppOnboard must deploy via az deployment sub create"
          );
        }
        expect(usedAzd).toBe(false);

        // Session integrity checks
        if (workspacePath) {
          assertSessionFileCreated(agentMetadata, workspacePath);
        }

        // Sub-agent assertions: scaffold + deploy must dispatch via task tool
        // Only assert each when the respective phase was actually reached
        if (hasReachedScaffoldPhase(agentMetadata)) {
          assertScaffoldSubagentsDispatched(agentMetadata);
        } else {
          agentMetadata.testComments.push("⚠️ SCAFFOLD PHASE NOT REACHED: Skipping scaffold sub-agent assertion");
        }
        if (hasReachedDeployPhase(agentMetadata)) {
          assertDeployPreflightSubagentDispatched(agentMetadata);
        } else {
          agentMetadata.testComments.push("⚠️ DEPLOY PHASE NOT REACHED: Skipping deploy sub-agent assertion");
        }
        assertNoSubagentFailures(agentMetadata);

        // All three must hold: ACR builds executed, Container Apps targeted, no manual steps
        // (individual expects above — this is a summary guard)
        expect((mentionsAcrBuild || executedAcrBuild) && mentionsContainerApps && !hasManualDeploySteps).toBe(true);
      });
    }, integrationTestTimeoutMs);
  });
});
