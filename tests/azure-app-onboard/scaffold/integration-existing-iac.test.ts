/**
 * Integration Tests — Scaffold Catalog (Existing IaC Detection)
 *
 * Tests scaffold-phase behaviors for repos with existing infrastructure:
 * - get-started-ai-agents: Existing azd + Foundry — must detect and not overwrite
 * - todo-nodejs-mongo: Canonical azd template — Key Vault + Cosmos + multi-component
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
  testTimeoutMs,
  shouldEarlyTerminateOnAzdDecisionGate,
  assertAzdDecisionGatePresented,
  assertSessionFileCreated,
  assertDatabaseDetected,
  isIaCFileWrite,
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
            "What did you find in my project?",
            "Should I use the existing infrastructure or start fresh?",
            "No, don't deploy. That's all I needed.",
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
    }, testTimeoutMs);

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
            "What infrastructure does my project already have?",
            "Should I use azd or deploy from scratch?",
            "No, don't deploy.",
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

        // Must detect multi-component (web + api)
        const detectsComponents =
          (messages.includes("web") || messages.includes("frontend")) &&
          (messages.includes("api") || messages.includes("backend"));
        if (!detectsComponents) {
          agentMetadata.testComments.push("⚠️ AZD: Did not identify web + api components");
        }
        expect(detectsComponents).toBe(true);

        // Must NOT silently overwrite existing IaC
        const toolCalls = getToolCalls(agentMetadata);
        const overwroteIaC = toolCalls.some(isIaCFileWrite);
        expect(overwroteIaC).toBe(false);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });
});
