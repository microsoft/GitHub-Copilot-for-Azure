/**
 * Integration Tests for ghcp-sdk-deploy
 *
 * Scenario 1: Deploy a Copilot Extension built with @copilot-extensions/preview-sdk
 * (Node.js/Express, SSE streaming) to Azure compute with all dependencies wired up.
 *
 * Multi-turn prompt flow:
 *   1. Deploy Copilot SDK Express app to Azure (Web App or Container Apps)
 *   2. Configure GITHUB_TOKEN via Key Vault, set COPILOT_AGENT_URL, add /health
 *   3. Add Azure AI Foundry OpenAI backend (GPT-4o) with managed identity
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
  countAcrAuthSpirals,
  countPortBindingConfusion,
  countHostingThrashing,
  countManagedIdentityFailures,
  countSseStreamingBreaks,
} from "../utils/regression-detectors";
import { setupCopilotSdkApp } from "../utils/ghcp-sdk-workspace";

const SKILL_NAME = "ghcp-sdk-deploy";

// Scoring limits
const MAX_DURATION_MS = 35 * 60 * 1000;
const MAX_TURNS = 55;
const MAX_DEPLOY_ATTEMPTS = 6;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  jest.setTimeout(MAX_DURATION_MS);

  let result: ConversationResult;

  describe("end-to-end deployment", () => {
    beforeAll(async () => {
      result = await runConversation({
        setup: setupCopilotSdkApp,
        nonInteractive: true,
        preserveWorkspace: true,
        maxTurns: MAX_TURNS,
        maxDeployAttempts: MAX_DEPLOY_ATTEMPTS,
        prompts: [
          {
            label: "Deploy to Azure compute",
            prompt:
              "Deploy this Copilot SDK Express app to Azure — pick Web App vs Container Apps and set it up end to end. Use my current subscription in eastus region.",
          },
          {
            label: "Secrets + health check",
            prompt:
              "Configure GITHUB_TOKEN via Key Vault, set COPILOT_AGENT_URL environment variable to the public endpoint, and add a /health endpoint that returns 200 with body containing 'ok'.",
          },
          {
            label: "Add AI Foundry backend",
            prompt:
              "Add an Azure AI Foundry OpenAI backend with GPT-4o model deployment using managed identity for authentication. Wire it into the agent endpoint.",
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
      expect(fs.existsSync(path.join(result.workspace, "package.json"))).toBe(true);
    });

    test("response contains deployment links", () => {
      expect(hasDeployLinks(result.aggregate)).toBe(true);
    });
  });

  describe("regression detectors", () => {
    test("no secrets in generated code", () => {
      expect(countSecretsInCode(result.aggregate)).toBe(0);
    });

    test("ACR auth spiral within limits", () => {
      expect(countAcrAuthSpirals(result.aggregate)).toBeLessThanOrEqual(3);
    });

    test("port binding confusion within limits", () => {
      expect(countPortBindingConfusion(result.aggregate)).toBeLessThanOrEqual(2);
    });

    test("hosting choice stable", () => {
      expect(countHostingThrashing(result.aggregate)).toBeLessThanOrEqual(2);
    });

    test("managed identity errors within limits", () => {
      expect(countManagedIdentityFailures(result.aggregate)).toBeLessThanOrEqual(2);
    });

    test("SSE streaming not broken", () => {
      expect(countSseStreamingBreaks(result.aggregate)).toBeLessThanOrEqual(1);
    });
  });
});
