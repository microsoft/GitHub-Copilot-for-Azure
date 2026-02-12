/**
 * Integration Tests for brownfield-dotnet (eShop)
 *
 * Clones the dotnet/eShop repository and tests deploying it to Azure
 * through a real Copilot agent session.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 3. Git must be installed and accessible
 *
 * Run with: npm run test:integration -- brownfield-dotnet
 */

import {
  isSkillInvoked,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../utils/agent-runner";
import { cloneRepo } from "../utils/git-clone";

const SKILL_NAME = "azure-deploy";
const ESHOP_REPO = "https://github.com/dotnet/eShop.git";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;
const deployTestTimeoutMs = 1800000; // 30 minutes

describeIntegration("brownfield-dotnet (eShop) - Deploy to Azure", () => {
  const agent = useAgentRunner();

  const FOLLOW_UP_PROMPT = ["Go with recommended options."];

  test("deploys eShop to Azure for small scale production", async () => {
    const agentMetadata = await agent.run({
      setup: async (workspace: string) => {
        await cloneRepo({
          repoUrl: ESHOP_REPO,
          targetDir: workspace,
          depth: 1,
        });
      },
      prompt:
        "Please deploy this application to Azure. " +
        "Use the eastus2 region. " +
        "Use my current subscription. " +
        "This is for a small scale production environment." +
        "Use standard SKUs",
      nonInteractive: true,
      followUp: FOLLOW_UP_PROMPT,
    });

    const isDeployInvoked = isSkillInvoked(agentMetadata, SKILL_NAME);
    const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
    const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");

    expect(isDeployInvoked).toBe(true);
    expect(isValidateInvoked).toBe(true);
    expect(isPrepareInvoked).toBe(true);
  }, deployTestTimeoutMs);
});
