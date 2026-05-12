/**
 * Integration Tests — Container Apps Code Deploy
 *
 * Validates that azure-app-onboard deploys code to Container Apps end-to-end,
 * not just IaC with placeholder images + manual "Next Steps."
 *
 * Tests B50 (Container Apps Phase 2 code deploy missing).
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
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  SKILL_NAME,
  shouldEarlyTerminateOnContainerAppsCodeDeploy,
  assertSessionFileCreated,
  cleanupSessionResourceGroups,
  assertAgentScannedWorkspace,
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
            "Go with defaults, keep costs low.",
            "Yes, that looks good. Generate new Bicep for me.",
            "Yes, proceed with scaffolding.",
            "Yes, deploy to Azure now.",
            "Yes, confirm the deployment.",
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

        // HARD: Must NOT present manual CLI commands as "Next Steps" for code deploy (B50)
        const hasManualDeploySteps =
          /next steps.{0,100}(docker build|docker push|deploy your code|az containerapp update)/i.test(messages);
        if (hasManualDeploySteps) {
          agentMetadata.testComments.push(
            "❌ Agent presented manual 'Next Steps' for code deploy instead of executing ACR builds"
          );
        }
        expect(hasManualDeploySteps).toBe(false);

        // HARD: Must mention ACR build — this test validates code deploy, not just IaC (B50)
        const mentionsAcrBuild =
          /az acr build|acr.{0,20}build|container.{0,20}registry.{0,20}build|image.{0,20}(build|push)/i.test(messages);
        if (!mentionsAcrBuild) {
          agentMetadata.testComments.push(
            "❌ Agent did not execute or mention ACR image builds — code deploy phase not reached"
          );
        }
        expect(mentionsAcrBuild).toBe(true);

        // SOFT: Communicate end-to-end code deploy (plans_end_to_end_code_deploy grader)
        // Non-blocking: agent may use varied phrasing for deploy completion.
        // ACR build + Container Apps mention + no manual steps is the hard signal (asserted separately).
        const plansE2eDeploy =
          /placeholder.{0,30}image|update.{0,30}image|replace.{0,30}(image|placeholder)|swap.{0,30}(image|placeholder)|redeploy|build.{0,50}(image|container).{0,50}(deploy|container.?app)|end.to.end.{0,30}deploy|deploy.{0,30}(application|app|code)|code.{0,30}deploy|push.{0,30}(image|container)|revision.{0,30}(update|creat|deploy)/i.test(messages);
        if (!plansE2eDeploy) {
          agentMetadata.testComments.push("⚠️ E2E DEPLOY: Agent did not communicate end-to-end code deploy (placeholder→image swap, redeploy, code/app deploy, push image, revision update) — ACR build + Container Apps asserted separately");
        }

        // HARD: Must identify Container Apps as the target compute
        const mentionsContainerApps = /container.?apps/i.test(messages);
        if (!mentionsContainerApps) {
          agentMetadata.testComments.push("❌ Agent did not mention Container Apps");
        }
        expect(mentionsContainerApps).toBe(true);

        // HARD: Must use Bicep, NOT Terraform — Bicep is the default IaC format
        const usedTerraform = /terraform (init|plan|apply)|\.tf\b|hashicorp\/azurerm/i.test(messages);
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

        // Must scan workspace (scans_repo grader)
        assertAgentScannedWorkspace(agentMetadata);

        // SOFT: Should notice Dockerfile presence
        const detectsDockerfile = /dockerfile|docker|container.{0,10}image/i.test(messages);
        if (!detectsDockerfile) {
          agentMetadata.testComments.push("⚠️ Agent did not mention Dockerfile");
        }

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

        // All three must hold: ACR builds executed, Container Apps targeted, no manual steps
        // (individual expects above — this is a summary guard)
        expect(mentionsAcrBuild && mentionsContainerApps && !hasManualDeploySteps).toBe(true);
      });
    }, 2_700_000); // 45 minutes — single-container deploy; 5 min headroom beyond 40-min followUpTimeout
  });
});
