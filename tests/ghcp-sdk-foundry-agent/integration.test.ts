/**
 * Integration Tests for ghcp-sdk-foundry-agent
 *
 * Scenario 2: Deploy a Copilot SDK agent as a Foundry hosted agent,
 * wire AI services, add tools, and bridge back to GitHub as a Copilot Extension.
 *
 * Multi-turn prompt flow:
 *   1. Deploy Copilot SDK agent as hosted agent in Azure AI Foundry
 *   2. Add GPT-4o model + AI Search index with managed identity
 *   3. Add code interpreter + file search tools, configure system prompt
 *   4. Bridge GitHub Copilot Extension webhook format to Foundry agent API
 *
 * Prerequisites:
 *   - npm install -g @github/copilot-cli
 *   - copilot auth
 *   - azd auth login
 */

import * as fs from "fs";
import * as path from "path";
import {
  isSkillInvoked,
  hasDeployLinks,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  runConversation,
  type ConversationResult,
} from "../utils/agent-runner";
import {
  countSecretsInCode,
  countManagedIdentityFailures,
  countModelDeploymentMissing,
  countFoundryConfusion,
  countAgentApiFormatMismatch,
  countAiSearchConnectionFailures,
} from "../utils/regression-detectors";
import { setupCopilotSdkApp } from "../utils/ghcp-sdk-workspace";

const SKILL_NAME = "ghcp-sdk-foundry-agent";

// Scoring limits
const MAX_DURATION_MS = 40 * 60 * 1000;
const MAX_TURNS = 60;
const MAX_DEPLOY_ATTEMPTS = 7;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  jest.setTimeout(MAX_DURATION_MS);

  let result: ConversationResult;

  describe("end-to-end Foundry deployment", () => {
    beforeAll(async () => {
      result = await runConversation({
        setup: setupCopilotSdkApp,
        nonInteractive: true,
        preserveWorkspace: true,
        maxTurns: MAX_TURNS,
        maxDeployAttempts: MAX_DEPLOY_ATTEMPTS,
        prompts: [
          {
            label: "Deploy as Foundry hosted agent",
            prompt:
              "Deploy this Copilot SDK agent as a hosted agent in Azure AI Foundry. Set up the Foundry project and agent configuration with managed runtime. Use my current subscription in eastus region.",
          },
          {
            label: "Add model + search",
            prompt:
              "Add a GPT-4o model deployment and an AI Search index as connected resources. Use managed identity for authentication to both services.",
          },
          {
            label: "Add tools + system prompt",
            prompt:
              "Add code interpreter and file search tools to the agent. Configure a system prompt that describes the agent as a helpful coding assistant.",
          },
          {
            label: "Bridge to GitHub Extension",
            prompt:
              "Create a bridge service that translates between the GitHub Copilot Extension webhook format (SSE streaming) and the Foundry agent API. Deploy it alongside the agent so it can receive requests from GitHub.",
          },
        ],
      });
    });

    afterAll(async () => {
      if (result?.workspace) {
        try {
          const { execSync } = require("child_process");
          execSync("azd down --force --purge", {
            cwd: result.workspace,
            timeout: 5 * 60 * 1000,
            stdio: "ignore",
          });
        } catch {
          // Best-effort cleanup
        }
        try {
          fs.rmSync(result.workspace, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    });

    test("invokes azure-prepare skill", () => {
      expect(isSkillInvoked(result.aggregate, "azure-prepare")).toBe(true);
    });

    test("invokes avm-bicep-rules skill", () => {
      expect(isSkillInvoked(result.aggregate, "avm-bicep-rules")).toBe(true);
    });

    test("workspace contains required files", () => {
      expect(fs.existsSync(path.join(result.workspace, "azure.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(result.workspace, "infra", "main.bicep"))).toBe(true);
    });

    test("response contains deployment links", () => {
      expect(hasDeployLinks(result.aggregate)).toBe(true);
    });
  });

  describe("regression detectors", () => {
    test("no secrets in generated code", () => {
      expect(countSecretsInCode(result.aggregate)).toBe(0);
    });

    test("Foundry vs OpenAI confusion within limits", () => {
      expect(countFoundryConfusion(result.aggregate)).toBeLessThanOrEqual(1);
    });

    test("model deployment errors within limits", () => {
      expect(countModelDeploymentMissing(result.aggregate)).toBeLessThanOrEqual(2);
    });

    test("AI Search connection errors within limits", () => {
      expect(countAiSearchConnectionFailures(result.aggregate)).toBeLessThanOrEqual(2);
    });

    test("managed identity errors within limits", () => {
      expect(countManagedIdentityFailures(result.aggregate)).toBeLessThanOrEqual(2);
    });

    test("agent API format mismatch within limits", () => {
      expect(countAgentApiFormatMismatch(result.aggregate)).toBeLessThanOrEqual(2);
    });

    // Foundry SDK version confusion detector — checks for wrong SDK imports
    test("Foundry SDK version confusion within limits", () => {
      expect(countFoundryConfusion(result.aggregate)).toBeLessThanOrEqual(2);
    });
  });
});
