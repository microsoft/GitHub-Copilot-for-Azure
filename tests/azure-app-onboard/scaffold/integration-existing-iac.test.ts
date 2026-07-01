/**
 * Integration Tests — Scaffold Catalog (Existing IaC Detection)
 *
 * Tests scaffold-phase behaviors for repos with existing infrastructure:
 * - get-started-ai-agents: Existing azd + Foundry — must detect and not overwrite
 * - todo-nodejs-mongo: Canonical azd template — Key Vault + Cosmos + multi-component
 * - microblog-ai-remix: Existing azd + Bicep — must detect and not overwrite (moved from scaffold/integration.test.ts)
 *
 * Extracted from integration-catalog-extended.test.ts — these focus on
 * existing IaC detection and non-overwrite (scaffold domain).
 */

import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getAllAssistantMessages,
  getToolCalls,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  scaffoldTestTimeoutMs,
  shouldEarlyTerminateOnAzdDecisionGate,
  assertAzdDecisionGatePresented,
  assertSessionFileCreated,
  assertDatabaseDetected,
  isIaCFileWrite,
  SUBSCRIPTION_PRIMER,
} from "../app-onboard-test-helpers";

describeAppOnboardWithCleanup("Scaffold Catalog Tests", (agent) => {
  describe("existing-azd", () => {
    test("e2e — get-started-ai-agents (existing azd + Foundry)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/Azure-Samples/get-started-with-ai-agents",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I have an existing app — what's the best way to migrate it to Azure?",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnAzdDecisionGate,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Must detect existing azure.yaml and Bicep infra
        assertAzdDecisionGatePresented(agentMetadata);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must detect AI/Foundry components
        const detectsAI =
          messages.includes("openai") || messages.includes("ai") ||
          messages.includes("foundry") || messages.includes("agent");
        if (!detectsAI) {
          agentMetadata.testComments.push("⚠️ AZD: Did not detect AI/Foundry framework");
        }
        expect(detectsAI).toBe(true);

        // Must NOT silently overwrite existing IaC
        const toolCalls = getToolCalls(agentMetadata);
        const overwroteIaC = toolCalls.some(isIaCFileWrite);
        if (overwroteIaC) {
          agentMetadata.testComments.push("❌ AZD: Agent overwrote existing IaC without user consent");
        }
        expect(overwroteIaC).toBe(false);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, scaffoldTestTimeoutMs);

    test("e2e — todo-nodejs-mongo (canonical azd template with Key Vault + Cosmos)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/Azure-Samples/todo-nodejs-mongo",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I just signed up for Azure. What's the fastest way to bring my app over?",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnAzdDecisionGate,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Must detect existing azure.yaml
        assertAzdDecisionGatePresented(agentMetadata);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must detect Cosmos DB / MongoDB
        assertDatabaseDetected(agentMetadata, "mongodb");

        // Key Vault detection — non-blocking because shouldEarlyTerminateOnAzdDecisionGate
        // fires at the decision gate before follow-ups enumerate infra services.
        const detectsKeyVault =
          messages.includes("key vault") || messages.includes("keyvault");
        if (!detectsKeyVault) {
          agentMetadata.testComments.push("⚠️ AZD: Did not detect existing Key Vault in infra (agent terminated at decision gate before enumerating services)");
        }

        // Multi-component detection (web + api) — non-blocking because
        // shouldEarlyTerminateOnAzdDecisionGate fires at the scope triage gate
        // before the agent analyzes azure.yaml services in detail.
        const detectsComponents =
          (messages.includes("web") || messages.includes("frontend")) &&
          (messages.includes("api") || messages.includes("backend"));
        if (!detectsComponents) {
          agentMetadata.testComments.push("⚠️ AZD: Did not identify web + api components (agent terminated at decision gate before enumerating services)");
        }

        // Must NOT silently overwrite existing IaC
        const toolCalls = getToolCalls(agentMetadata);
        const overwroteIaC = toolCalls.some(isIaCFileWrite);
        expect(overwroteIaC).toBe(false);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, scaffoldTestTimeoutMs);
  });

  describe("existing-azd-remix", () => {
    test("e2e — microblog-ai-remix (existing azd + Bicep — must not overwrite)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/Azure-Samples/microblog-ai-remix",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I have a prototype ready — help me get it to production on Azure",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Go with recommended options.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) => {
            if (getToolCalls(metadata).length < 5) return false;
            return shouldEarlyTerminateOnAzdDecisionGate(metadata);
          },
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must acknowledge existing IaC (hard assertion)
        const detectsExisting =
          messages.includes("existing") || messages.includes("already") ||
          messages.includes("found") || messages.includes("detected") ||
          messages.includes("main.bicep") || messages.includes("azure.yaml") ||
          messages.includes("bicep") || messages.includes("infra/");
        if (!detectsExisting) {
          agentMetadata.testComments.push("❌ SCAFFOLD: Did not detect existing IaC files in infra/");
        }
        expect(detectsExisting).toBe(true);

        // Must NOT silently overwrite existing IaC
        const toolCalls = getToolCalls(agentMetadata);
        const overwroteIaC = toolCalls.some(isIaCFileWrite);
        if (overwroteIaC) {
          agentMetadata.testComments.push("❌ SCAFFOLD VIOLATION: Agent overwrote existing IaC in infra/ without user confirmation");
        }
        expect(overwroteIaC).toBe(false);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, scaffoldTestTimeoutMs);
  });
});
