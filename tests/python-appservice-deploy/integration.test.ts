/**
 * Integration Tests for python-appservice-deploy
 *
 * End-to-end test that:
 *   1. Clones a sample Flask app
 *   2. Asks the agent to deploy it to Azure App Service
 *   3. Verifies the python-appservice-deploy skill is invoked
 *   4. Verifies the agent uses `az webapp deploy` (NOT the deprecated
 *      `az webapp up`) and includes the post-deploy URL message
 *
 * Prerequisites:
 *   1. npm install -g @github/copilot-cli
 *   2. Run `copilot` and authenticate
 *   3. `az login` against a real subscription
 *   4. The agent will create a real resource group + App Service Plan + Web App
 *
 * Skip locally with: SKIP_INTEGRATION_TESTS=true
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
} from "../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
} from "../utils/evaluate";
import { cloneRepo } from "../utils/git-clone";

const SKILL_NAME = "python-appservice-deploy";

const FLASK_QUICKSTART_REPO =
  "https://github.com/Azure-Samples/msdocs-python-flask-webapp-quickstart.git";

const pseudoRandomResourceGroupSystemPrompt = {
  mode: "append" as const,
  content:
    "Use a pseudo-random resource group name (suffix with random characters) to avoid collisions with existing resource groups.",
};

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}
const describeIntegration = skipTests ? describe.skip : describe;

const e2eDeployTimeoutMs = 30 * 60 * 1000; // 30 minutes (clone + create + deploy)

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner({
    isTest: true,
    useJest: true,
  });

  describe("e2e-flask-deploy", () => {
    test(
      "deploys Flask quickstart to App Service via python-appservice-deploy",
      async () => {
        await withTestResult(async () => {
          let workspacePath: string | undefined;

          const agentMetadata = await agent.run({
            setup: async (workspace: string) => {
              workspacePath = workspace;
              await cloneRepo({
                repoUrl: FLASK_QUICKSTART_REPO,
                targetDir: workspace,
                depth: 1,
              });
            },
            prompt:
              "I have a Flask sample app in this workspace. " +
              "Use my current Azure subscription and the eastus2 region. " +
              "Deploy this Flask app to Azure App Service.",
            systemPrompt: pseudoRandomResourceGroupSystemPrompt,
            nonInteractive: true,
            followUpTimeout: e2eDeployTimeoutMs,
          });

          // 1. Skill must have been invoked
          softCheckSkill(agentMetadata, SKILL_NAME);
          expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

          // 2. Skill must have used a supported deploy command (azd OR az webapp deploy),
          //    and must NOT have used the forbidden `az webapp up`.
          const usedSupportedDeploy =
            doesAssistantMessageIncludeKeyword(agentMetadata, "az webapp deploy") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "azd deploy") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "azd up");
          expect(usedSupportedDeploy).toBe(true);

          const usedForbiddenDeploy = doesAssistantMessageIncludeKeyword(
            agentMetadata,
            "az webapp up"
          );
          expect(usedForbiddenDeploy).toBe(false);

          // 3. Post-deploy message should include the azurewebsites.net URL
          const mentionsAppUrl = doesAssistantMessageIncludeKeyword(
            agentMetadata,
            "azurewebsites.net"
          );
          expect(mentionsAppUrl).toBe(true);

          // 4. Workspace was set up (sanity check the sample was cloned)
          expect(workspacePath).toBeDefined();
        });
      },
      e2eDeployTimeoutMs
    );
  });
});
