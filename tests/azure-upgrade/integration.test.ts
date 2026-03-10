/**
 * Integration Tests for azure-upgrade
 *
 * Tests skill behavior with a real Copilot agent session.
 * Uses two prompts via the Copilot CLI:
 *   1. Create a Linux Consumption function app using the shell script and deploy hello-world code
 *   2. Migrate the app to Flex Consumption
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 3. Azure CLI authenticated with an active subscription
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../utils/agent-runner";
import { isSkillInvoked, expectFiles, softCheckSkill, shouldEarlyTerminateForSkillInvocation } from "../utils/evaluate";
import * as path from "path";
import * as fs from "fs";

const SKILL_NAME = "azure-upgrade";

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;
const upgradeTestTimeoutMs = 2700000;
const FOLLOW_UP_PROMPT = ["Go with recommended options."];

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("upgrade-functions-consumption-to-flex", () => {
    test("creates consumption app, deploys code, then upgrades to flex consumption", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;

          // Copy the shell script into the workspace so the agent can reference it
          const scriptSource = path.join(__dirname, "create-function-app-consumption.sh");
          const scriptDest = path.join(workspace, "create-function-app-consumption.sh");
          fs.copyFileSync(scriptSource, scriptDest);
        },
        prompt:
          "Create a Linux consumption function app using the create-function-app-consumption.sh shell script " +
          "in this workspace and then deploy a hello world code into it. " +
          "Use my current subscription.",
        nonInteractive: true,
        followUp: [
          "Validate if the deployed function app is Linux before proceeding with the migration. " +
          "Now migrate this app to flex consumption. " +
          "The new app should have the same name as the source app but with a '-flex' suffix. " +
          "Go with recommended options.",
        ],
      });

      // Verify the azure-upgrade skill was invoked
      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      // Verify upgrade assessment report was created in the workspace
      expect(workspacePath).toBeDefined();
      expectFiles(workspacePath!, [
        /upgrade-assessment-report\.md$|upgrade-status\.md$|assessment.*\.md$/i,
      ], []);
    }, upgradeTestTimeoutMs);
  });
});