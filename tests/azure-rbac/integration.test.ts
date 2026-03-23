/**
 * Integration Tests for azure-rbac
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "azure-rbac";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-rbac skill for role recommendation prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          try {
            const agentMetadata = await agent.run({
              prompt: "What role should I assign to my managed identity to read images in an Azure Container Registry?",
              shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
              console.log("⏭️  SDK not loadable, skipping test");
              return;
            }
            throw e;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-rbac skill for least privilege role prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          try {
            const agentMetadata = await agent.run({
              prompt: "What is the least privilege role for reading blob storage?",
              shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
              console.log("⏭️  SDK not loadable, skipping test");
              return;
            }
            throw e;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });
  });

  describe("azure-rbac", () => {
    test("invokes azure-rbac skill for AcrPull prompt", async () => {
      await withTestResult(async () => {
        let agentMetadata;
        try {
          agentMetadata = await agent.run({
            prompt: "What role should I assign to my managed identity to read images in an Azure Container Registry?"
          });
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }

        const isSkillUsed = isSkillInvoked(agentMetadata, "azure-rbac");
        const isAcrPullRoleMentioned = doesAssistantMessageIncludeKeyword(agentMetadata, "AcrPull");
        const hasCLICommand = doesAssistantMessageIncludeKeyword(agentMetadata, "az role assignment");
        const hasBicepCode = doesAssistantMessageIncludeKeyword(agentMetadata, "Microsoft.Authorization/roleAssignments");

        // User asks "What role should I assign" - role discovery scenario
        // Expects: skill invocation, AcrPull role mentioned, CLI commands, and Bicep code
        expect(isSkillUsed).toBe(true);
        expect(isAcrPullRoleMentioned).toBe(true);
        expect(hasCLICommand).toBe(true);
        expect(hasBicepCode).toBe(true);
      });
    });

    test("recommends Storage Blob Data Reader for blob read access", async () => {
      await withTestResult(async () => {
        let agentMetadata;
        try {
          agentMetadata = await agent.run({
            prompt: "What Azure role should I use to give my app read-only access to blob storage?"
          });
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }

        const isSkillUsed = isSkillInvoked(agentMetadata, "azure-rbac");
        const mentionsStorageRole = doesAssistantMessageIncludeKeyword(agentMetadata, "Storage Blob Data Reader");
        const hasCLICommand = doesAssistantMessageIncludeKeyword(agentMetadata, "az role assignment");
        const hasBicepCode = doesAssistantMessageIncludeKeyword(agentMetadata, "Microsoft.Authorization/roleAssignments");

        // User asks "What Azure role should I use" - role discovery scenario
        // Expects: skill invocation, Storage Blob Data Reader role mentioned, CLI commands, and Bicep code
        expect(isSkillUsed).toBe(true);
        expect(mentionsStorageRole).toBe(true);
        expect(hasCLICommand).toBe(true);
        expect(hasBicepCode).toBe(true);
      });
    });

    test("recommends Key Vault Secrets User for secret access", async () => {
      await withTestResult(async () => {
        let agentMetadata;
        try {
          agentMetadata = await agent.run({
            prompt: "What role do I need to read secrets from Azure Key Vault?"
          });
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }

        const isSkillUsed = isSkillInvoked(agentMetadata, "azure-rbac");
        const mentionsKeyVaultRole = doesAssistantMessageIncludeKeyword(agentMetadata, "Key Vault Secrets User");
        const hasCLICommand = doesAssistantMessageIncludeKeyword(agentMetadata, "az role assignment");
        const hasBicepCode = doesAssistantMessageIncludeKeyword(agentMetadata, "Microsoft.Authorization/roleAssignments");

        // User asks "What role do I need" - role discovery scenario
        // Expects: skill invocation, Key Vault Secrets User role mentioned, CLI commands, and Bicep code
        expect(isSkillUsed).toBe(true);
        expect(mentionsKeyVaultRole).toBe(true);
        expect(hasCLICommand).toBe(true);
        expect(hasBicepCode).toBe(true);
      });
    });

    test("generates CLI commands for role assignment", async () => {
      await withTestResult(async () => {
        let agentMetadata;
        try {
          agentMetadata = await agent.run({
            prompt: "Generate Azure CLI command to assign Storage Blob Data Contributor role to my managed identity"
          });
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }

        const isSkillUsed = isSkillInvoked(agentMetadata, "azure-rbac");
        const mentionsRole = doesAssistantMessageIncludeKeyword(agentMetadata, "Storage Blob Data Contributor");
        const hasCLICommand = doesAssistantMessageIncludeKeyword(agentMetadata, "az role assignment");

        // User explicitly specifies the role name ("Storage Blob Data Contributor") and requests CLI command generation
        // Expects: skill invocation, role name mentioned, and CLI commands
        expect(isSkillUsed).toBe(true);
        expect(mentionsRole).toBe(true);
        expect(hasCLICommand).toBe(true);
      });
    });

    test("provides Bicep code for role assignment", async () => {
      await withTestResult(async () => {
        let agentMetadata;
        try {
          agentMetadata = await agent.run({
            prompt: "Show me Bicep code to assign Contributor role to a managed identity on a storage account"
          });
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }

        const isSkillUsed = isSkillInvoked(agentMetadata, "azure-rbac");
        const mentionsRole = doesAssistantMessageIncludeKeyword(agentMetadata, "Contributor");
        const hasBicepCode = doesAssistantMessageIncludeKeyword(agentMetadata, "Microsoft.Authorization/roleAssignments");

        // User explicitly specifies exact role and only requests Bicep code
        // Expects: skill invocation, role name mentioned, and Bicep code
        expect(isSkillUsed).toBe(true);
        expect(mentionsRole).toBe(true);
        expect(hasBicepCode).toBe(true);
      });
    });
  });

});