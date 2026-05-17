/**
 * Integration Test for azure-reliability
 *
 * End-to-end test that:
 *   1. Clones a sample Azure Functions app (functions-quickstart-javascript-azd)
 *   2. Asks the agent to "assess and improve reliability of my function app"
 *   3. Verifies the azure-reliability skill is invoked and produces an assessment
 *      (zone redundancy = OFF on the FC1 plan in the sample)
 *   4. Lets the agent deploy the zone-redundancy fix (the safe quick-win patch)
 *   5. Re-runs the assessment and verifies zone redundancy is now ON
 *
 * Prerequisites:
 *   1. npm install -g @github/copilot-cli
 *   2. Run `copilot` and authenticate
 *   3. `az login` and `azd auth login` against a real subscription
 *   4. The agent will create a real resource group and resources during the run
 *
 * NOT TESTED HERE (intentionally):
 *   - Storage redundancy upgrade (LRS/GRS → ZRS) — the live Azure storage
 *     migration takes hours to days; not feasible in CI. The skill correctly
 *     schedules it as a separate "Deploy 2" after asking the user (covered
 *     by unit tests).
 *   - Multi-region failover with Azure Front Door — provisions a second region
 *     of compute + Front Door (~2x cost, 10+ minute deploy, plus DNS
 *     propagation). The wait-and-confirm gate is covered by unit tests.
 *   Both are exercised manually before each demo / release.
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

const SKILL_NAME = "azure-reliability";

const FUNCTIONS_QUICKSTART_REPO =
  "https://github.com/Azure-Samples/functions-quickstart-javascript-azd.git";

const pseudoRandomResourceGroupSystemPrompt = {
  mode: "append" as const,
  content:
    "Use a pseudo-random resource group name (suffix with random characters) to avoid collisions with existing resource groups.",
};

// Centralized skip logic
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}
const describeIntegration = skipTests ? describe.skip : describe;

const e2eDeployTimeoutMs = 60 * 60 * 1000; // 1 hour (clone + first deploy + assess + patch + second deploy + re-assess)

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("e2e-zone-redundancy-fix", () => {
    test(
      "assess function app, deploy ZR fix, verify ZR is now ON",
      async () => {
        await withTestResult(async () => {
          let workspacePath: string | undefined;

          // Single agent run drives the full flow:
          //  - Initial prompt: assess + improve reliability of the function app
          //  - Follow-up #1: confirm we want to fix it via IaC patches
          //  - Follow-up #2: confirm the deploy
          //  - Follow-up #3: skip storage upgrade (we don't want a multi-hour migration here)
          //  - Follow-up #4: re-assess and report
          const agentMetadata = await agent.run({
            setup: async (workspace: string) => {
              workspacePath = workspace;
              await cloneRepo({
                repoUrl: FUNCTIONS_QUICKSTART_REPO,
                targetDir: workspace,
                depth: 1,
              });
            },
            prompt:
              "I have an Azure Functions sample app in this workspace. " +
              "Use my current Azure subscription and the eastus2 region. " +
              "Assess and improve the reliability of my function app. " +
              "When you ask about storage migration, decline (no/later). " +
              "Multi-region is not needed.",
            systemPrompt: pseudoRandomResourceGroupSystemPrompt,
            nonInteractive: true,
            followUp: [
              "Yes, proceed with the quick-win zone-redundancy fix using IaC patches (Path B).",
              "Yes, deploy now.",
              "No to storage migration — leave storage as-is.",
              "Now re-run the reliability assessment and confirm zone redundancy is ON for the compute plan.",
            ],
            followUpTimeout: e2eDeployTimeoutMs,
          });

          // 1. Skill must have been invoked
          softCheckSkill(agentMetadata, SKILL_NAME);
          expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

          // 2. Initial assessment must mention zone redundancy as a gap
          //    (the FC1 plan in the sample has zoneRedundant: false / unset by default)
          const mentionsZRGap =
            doesAssistantMessageIncludeKeyword(agentMetadata, "Zone redundancy") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "zone redundant") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "zoneRedundant");
          expect(mentionsZRGap).toBe(true);

          // 3. The skill should have driven a deploy itself (azd up / az deployment / terraform apply)
          //    rather than punting to the user. The transcript should mention one of these.
          const ranADeploy =
            doesAssistantMessageIncludeKeyword(agentMetadata, "azd up") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "az deployment") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "terraform apply") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "Deployed");
          expect(ranADeploy).toBe(true);

          // 4. Re-assessment after the fix must show ZR is now ON for compute
          //    (look for the 🟢 marker or the literal "now ON" annotation from
          //    the Re-Assess template in SKILL.md)
          const reassessShowsZROn =
            doesAssistantMessageIncludeKeyword(agentMetadata, "🟢 ON") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "now ON") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "zoneRedundant: true") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "Zone redundant: ✅");
          expect(reassessShowsZROn).toBe(true);

          // 5. Workspace was set up (sanity check the sample was cloned)
          expect(workspacePath).toBeDefined();
        });
      },
      e2eDeployTimeoutMs
    );
  });
});
