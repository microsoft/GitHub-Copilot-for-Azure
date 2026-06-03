/**
 * Integration Tests for python-appservice-deploy
 *
 * End-to-end test that:
 *   1. Clones a sample Flask app
 *   2. Asks the agent to deploy it to Azure App Service
 *   3. Verifies the python-appservice-deploy skill is invoked
 *   4. Verifies the agent runs a supported deploy command (azd OR
 *      `az webapp deploy`) and NEVER runs the deprecated `az webapp up`
 *      (asserted against actually-executed shell commands, not assistant text)
 *
 * Prerequisites:
 *   1. npm install -g @github/copilot-cli
 *   2. Run `copilot` and authenticate
 *   3. `az login` against a real subscription
 *   4. The agent will create a real resource group + App Service Plan + Web App
 *
 * Cleanup:
 *   The `afterAll` hook attempts to delete the created resource group via
 *   `az group delete --yes --no-wait`. The hook is best-effort and never
 *   fails the test (the integration job is also expected to run a sweep on a
 *   schedule — see `eng/test-subscription-cleanup/`).
 *
 * Skip locally with: SKIP_INTEGRATION_TESTS=true
 */

import { execFileSync } from "child_process";
import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  type AgentMetadata,
} from "../utils/agent-runner";
import {
  isSkillInvoked,
  matchesCommand,
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

/**
 * Extract the resource group name the agent used during the run by scanning
 * actually-executed shell commands for `--resource-group <name>` or `-g <name>`.
 * Returns the first match found, or undefined if no RG flag was used.
 */
function extractResourceGroupFromRun(
  metadata: AgentMetadata
): string | undefined {
  // We can't import getShellCommands directly (it's internal to evaluate.ts),
  // so scan tool.execution_start events for shell tools and look at args.
  const shellTools = ["powershell", "bash"];
  for (const event of metadata.events) {
    if (event.type !== "tool.execution_start") continue;
    const data = event.data as {
      toolName?: string;
      arguments?: { command?: string };
    };
    if (!data.toolName || !shellTools.includes(data.toolName)) continue;
    const cmd = data.arguments?.command ?? "";
    // Prefer --resource-group <name>; fall back to -g <name>.
    const long = cmd.match(/--resource-group\s+(\S+)/);
    if (long) return long[1].replace(/^["']|["']$/g, "");
    const short = cmd.match(/(?:^|\s)-g\s+(\S+)/);
    if (short) return short[1].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

describeIntegration(`${SKILL_NAME}_deployment-flow - Integration Tests`, () => {
  const agent = useAgentRunner({
    isTest: true,
    useJest: true,
  });

  // Track the resource group the agent created so we can clean it up.
  let createdResourceGroup: string | undefined;

  afterAll(() => {
    if (!createdResourceGroup) {
      console.log(
        "⏭️  No resource group captured from agent run — skipping cleanup."
      );
      return;
    }
    console.log(
      `🧹 Best-effort cleanup: az group delete --name ${createdResourceGroup} --yes --no-wait`
    );
    try {
      execFileSync(
        "az",
        ["group", "delete", "--name", createdResourceGroup, "--yes", "--no-wait"],
        { stdio: "inherit", timeout: 60_000 }
      );
    } catch (err) {
      // Never fail the test on cleanup. The cleanup job in
      // eng/test-subscription-cleanup/ is the durable safety net.
      console.warn(
        `⚠️  Cleanup of resource group '${createdResourceGroup}' failed: ${
          (err as Error).message
        }. The scheduled cleanup job should remove it.`
      );
    }
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

          // Capture the resource group for afterAll cleanup, even on test failure.
          createdResourceGroup = extractResourceGroupFromRun(agentMetadata);

          // 1. Skill must have been invoked
          softCheckSkill(agentMetadata, SKILL_NAME);
          expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

          // 2. Skill must have actually EXECUTED a supported deploy command
          //    (azd OR `az webapp deploy`), not just mentioned it in assistant text.
          //    H12: assert against executed commands, not assistant message text.
          const ranAzWebappDeploy = matchesCommand(
            agentMetadata,
            /\baz\s+webapp\s+deploy\b/i
          );
          const ranAzdDeploy = matchesCommand(
            agentMetadata,
            /\bazd\s+(deploy|up)\b/i
          );
          expect(ranAzWebappDeploy || ranAzdDeploy).toBe(true);

          // 3. Skill must NOT have executed the deprecated `az webapp up`.
          //    H9: word-boundary regex so `az webapp update` does not match.
          //    Asserted against executed commands (H12), not assistant text —
          //    SKILL.md legitimately mentions `az webapp up` in its
          //    "deprecated, do not run" explanation.
          const ranForbiddenDeploy = matchesCommand(
            agentMetadata,
            /\baz\s+webapp\s+up(?!date)\b/i
          );
          expect(ranForbiddenDeploy).toBe(false);

          // 4. Post-deploy message should include the azurewebsites.net URL
          const mentionsAppUrl = doesAssistantMessageIncludeKeyword(
            agentMetadata,
            "azurewebsites.net"
          );
          expect(mentionsAppUrl).toBe(true);

          // 5. Workspace was set up (sanity check the sample was cloned)
          expect(workspacePath).toBeDefined();
        });
      },
      e2eDeployTimeoutMs
    );
  });
});
