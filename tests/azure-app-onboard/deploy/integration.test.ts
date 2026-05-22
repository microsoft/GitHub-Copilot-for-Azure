/**
 * Integration Tests for azure-app-onboard/deploy subskill
 *
 * Tests unique deploy behaviors that can't be covered by seeded fixtures:
 * - Error classification: IAC_ERROR detection with broken Bicep
 * - No imperative CLI fallback on auth errors
 * - Region change requires re-approval gate
 * - Zip creation with correct directory structure
 *
 * Moved to deploy/integration-deploy-verification.test.ts (seeded fixtures):
 * - Imperative CLI ban → consolidated deploy test
 * - Entra auth for code deployment → consolidated deploy test
 * - deploy-delegation routing → redundant with catalog e2e
 * - approval gate reached → redundant with catalog e2e
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
import type { AgentMetadata } from "../../utils/agent-runner";
import {
  SKILL_NAME,
  cleanupSessionResourceGroups,
  assertNoAzdCommands,
  shellCommandContains,
  SUBSCRIPTION_PRIMER,
} from "../app-onboard-test-helpers";
import * as fs from "fs";
import * as path from "path";

const testTimeoutMs = 3600000; // 60 minutes

/**
 * Early terminate once the agent presents deploy-domain output
 * (approval gate, preflight results, or deployment commands).
 */
function shouldEarlyTerminateForDeployOutput(agentMetadata: AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    if (getToolCalls(agentMetadata).length > 10) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

  const hasApprovalGate =
    messages.includes("ready to deploy") ||
    messages.includes("ready to proceed") ||
    messages.includes("shall i proceed") ||
    (messages.includes("yes") && messages.includes("edit plan") && messages.includes("cancel"));

  const hasPreflight =
    messages.includes("preflight") ||
    messages.includes("what-if") ||
    messages.includes("terraform plan") ||
    messages.includes("az deployment");

  const toolCalls = getToolCalls(agentMetadata);
  const hasScaffoldOrDeploy = toolCalls.some(tc => {
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    const isIaCWrite = (tc.data.toolName === "create_file" || tc.data.toolName === "write_file") &&
      (args.includes(".bicep") || args.includes(".tf"));
    const isDeployCmd = args.includes("azd up") || args.includes("azd provision") ||
      args.includes("az deployment") || args.includes("terraform apply");
    return isIaCWrite || isDeployCmd;
  });

  return hasApprovalGate || hasPreflight || hasScaffoldOrDeploy;
}

/**
 * Early terminate once the agent acknowledges the Bicep error or applies a fix.
 */
function shouldEarlyTerminateForErrorFix(agentMetadata: AgentMetadata): boolean {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

  const identifiesError =
    messages.includes("api version") ||
    messages.includes("2024-99-01") ||
    messages.includes("invalidtemplate") ||
    messages.includes("not supported");

  const messagesWithoutBad = messages.replace(/2024-99-01/g, "");
  const suggestsSpecificVersion = /20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/.test(messagesWithoutBad);

  return identifiesError && suggestsSpecificVersion;
}

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_deploy - Integration Tests`, () => {
  const _agent = useAgentRunner();
  let lastMetadata: AgentMetadata | undefined;
  afterEach(() => { if (lastMetadata) { assertNoAzdCommands(lastMetadata); cleanupSessionResourceGroups(lastMetadata); lastMetadata = undefined; } });
  const agent = { run: async (...args: Parameters<typeof _agent.run>) => { const m = await _agent.run(...args); lastMetadata = m; return m; } };

  describe("error-classification", () => {
    test("error classification routes back to scaffold fix", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
            // Write a broken Bicep file with an invalid API version
            const infraDir = path.join(workspace, "infra");
            fs.mkdirSync(infraDir, { recursive: true });
            fs.writeFileSync(path.join(infraDir, "main.bicep"), [
              "targetScope = 'resourceGroup'",
              "",
              "param location string = resourceGroup().location",
              "param appName string = 'bya-simple-web-app'",
              "",
              "resource appServicePlan 'Microsoft.Web/serverfarms@2024-99-01' = {",
              "  name: '${appName}-plan'",
              "  location: location",
              "  sku: {",
              "    name: 'F1'",
              "    tier: 'Free'",
              "  }",
              "  kind: 'linux'",
              "  properties: {",
              "    reserved: true",
              "  }",
              "}",
              "",
              "resource webApp 'Microsoft.Web/sites@2024-99-01' = {",
              "  name: appName",
              "  location: location",
              "  properties: {",
              "    serverFarmId: appServicePlan.id",
              "    siteConfig: {",
              "      linuxFxVersion: 'NODE|20-lts'",
              "    }",
              "  }",
              "}",
            ].join("\n"));
          },
          prompt: "I have a prototype ready — help me get it to production on Azure.",
          nonInteractive: true,
          preserveWorkspace: true,
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes, proceed.",
            "Yes, go ahead.",
            "Yes, continue.",
            "Yes.",
            "Yes.",
          ],
          shouldEarlyTerminate: shouldEarlyTerminateForErrorFix,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        const identifiesError =
          messages.includes("api version") || messages.includes("2024-99-01") ||
          messages.includes("invalidtemplate") || messages.includes("not supported");

        // Check if agent used an MCP tool to look up the valid API version
        // (bicepschema, az provider show, ARM reference) rather than guessing from training data
        const toolCalls = getToolCalls(agentMetadata);
        const usedSchemaLookupTool = toolCalls.some(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
          return toolName.includes("bicep") || toolName.includes("schema") ||
            (toolName.includes("powershell") && args.includes("az provider show")) ||
            (toolName.includes("powershell") && args.includes("apiversion"));
        });

        const messagesWithoutBadVersion = messages.replace(/2024-99-01/g, "");
        const suggestsSpecificFix = /20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/.test(messagesWithoutBadVersion);

        if (!identifiesError) {
          agentMetadata.testComments.push("⚠️ Agent did not identify the API version error");
        }
        if (!suggestsSpecificFix && !usedSchemaLookupTool) {
          agentMetadata.testComments.push("⚠️ Agent did not suggest a specific valid API version or call a schema lookup tool");
        }

        expect(identifiesError).toBe(true);
        expect(suggestsSpecificFix || usedSchemaLookupTool).toBe(true);
      });
    }, testTimeoutMs);
  });

  describe("deploy-safety", () => {
    test("no imperative CLI fallback on auth error", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/Arun07AK/broken-todo-demo", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I built a side project and want to get it live on Azure",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForDeployOutput,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Check actual shell commands, NOT assistant messages — messages include
        // checklist blocked patterns that document these as forbidden.
        const fallsBackToCli =
          shellCommandContains(agentMetadata, "az group create") ||
          shellCommandContains(agentMetadata, "az appservice plan create") ||
          shellCommandContains(agentMetadata, "az webapp create");
        if (fallsBackToCli) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent ran imperative CLI resource creation instead of classifying as ENVIRONMENT_BLOCKING");
        }
        expect(fallsBackToCli).toBe(false);

        const suggestsGraphScope = messages.includes("graph.microsoft.com");
        if (suggestsGraphScope) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent suggested graph.microsoft.com scope for ARM deployment auth");
        }
        expect(suggestsGraphScope).toBe(false);

        const classifiesBlocking =
          messages.includes("environment") || messages.includes("blocking") ||
          messages.includes("conditional access") || messages.includes("cannot authenticate") ||
          messages.includes("policy");
        if (!classifiesBlocking) {
          agentMetadata.testComments.push("⚠️ Agent did not classify auth error as environment-blocking");
        }

        const offersBicep =
          messages.includes("bicep") || messages.includes("az deployment");
        if (!offersBicep) {
          agentMetadata.testComments.push("⚠️ Agent did not offer Bicep as alternative to blocked Terraform");
        }
      });
    }, testTimeoutMs);

    test("region change requires re-approval", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/rwieruch/node-express-server-rest-api", targetDir: workspace, branch: "master", depth: 1 });
          },
          prompt: "Can you walk me through getting my first app on Azure?",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) => {
            if (!isSkillInvoked(metadata, SKILL_NAME)) {
              if (getToolCalls(metadata).length > 3) return true;
              return false;
            }
            const calls = getToolCalls(metadata).length;
            if (calls < 10) return false;
            return shouldEarlyTerminateForDeployOutput(metadata);
          },
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        const presentsRegions =
          messages.includes("eastus2") || messages.includes("westus") ||
          messages.includes("westus2") || messages.includes("centralus");
        if (!presentsRegions) {
          agentMetadata.testComments.push("⚠️ Agent did not suggest alternative regions after quota failure");
        }

        const asksForApproval =
          messages.includes("approve") || messages.includes("proceed") ||
          messages.includes("confirm") || messages.includes("updated plan") ||
          messages.includes("ready to deploy") || messages.includes("would you like");
        if (!asksForApproval) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent changed region without re-presenting approval gate");
        }
        expect(asksForApproval).toBe(true);
      });
    }, testTimeoutMs);

    test("zip creation with correct directory structure", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/dev-arv13/demo-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I'm new to Azure. Can you get my existing app running without me setting up infrastructure?",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) => {
            // Terminate once a zip/compress/publish command appears in tool calls
            const tc = getToolCalls(metadata);
            return tc.some(t => {
              const toolName = (t.data.toolName ?? "").toLowerCase();
              if (toolName !== "powershell" && toolName !== "bash" && toolName !== "run_in_terminal") return false;
              const cmd = ((t.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
              return /compress-archive|system\.io\.compression|zip|webapp\s+deploy|az\s+webapp.*publish/.test(cmd);
            });
          },
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const zipToolCalls = getToolCalls(agentMetadata);
        const suggestsBadPattern = zipToolCalls.some(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          if (toolName !== "powershell" && toolName !== "bash" && toolName !== "run_in_terminal") return false;
          const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
          return /compress-archive.*fullname|\$files\.fullname/i.test(cmd);
        });
        if (suggestsBadPattern) {
          agentMetadata.testComments.push("❌ ZIP STRUCTURE: Agent used Compress-Archive with FullName — loses directory structure");
        }
        expect(suggestsBadPattern).toBe(false);
      });
    }, 3000000);
  });
});
