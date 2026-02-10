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
  countAcrAdminCredentialUsage,
  countMissingKeyVaultForToken,
  countWrongSessionOnPattern,
  countInlineHtmlInCode,
} from "../utils/regression-detectors";

const SKILL_NAME = "ghcp-sdk-foundry-agent";

// ─── File helpers ────────────────────────────────────────────────────────────

/** Recursively find files matching a name pattern in a directory */
function findFiles(dir: string, name: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".azure") {
        results.push(...findFiles(fullPath, name));
      } else if (entry.name === name) {
        results.push(fullPath);
      }
    }
  } catch { /* ignore permission errors */ }
  return results;
}

/** Find .js/.ts/.mjs source files in the workspace */
function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".azure") {
        results.push(...findSourceFiles(fullPath));
      } else if (/\.(js|ts|mjs)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch { /* ignore permission errors */ }
  return results;
}

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
        nonInteractive: true,
        preserveWorkspace: true,
        maxTurns: MAX_TURNS,
        maxDeployAttempts: MAX_DEPLOY_ATTEMPTS,
        prompts: [
          {
            label: "Deploy as Foundry hosted agent",
            prompt:
              "Create a Copilot Extension using the Copilot SDK and deploy it as a hosted agent in Azure AI Foundry. Use my current subscription in eastus region.",
          },
          {
            label: "Add model + search",
            prompt:
              "Add a GPT-4o model and an AI Search index as connected resources with managed identity.",
          },
          {
            label: "Add tools + system prompt",
            prompt:
              "Add code interpreter and file search tools. Set the system prompt to describe a helpful coding assistant.",
          },
          {
            label: "Bridge to GitHub Extension",
            prompt:
              "Bridge this Foundry agent back to GitHub as a Copilot Extension with a webhook service.",
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

    test("invokes azure-validate skill", () => {
      expect(isSkillInvoked(result.aggregate, "azure-validate")).toBe(true);
    });

    test("invokes avm-bicep-rules skill", () => {
      expect(isSkillInvoked(result.aggregate, "avm-bicep-rules")).toBe(true);
    });

    test("workspace contains required files", () => {
      expect(fs.existsSync(path.join(result.workspace, "azure.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(result.workspace, "infra", "main.bicep"))).toBe(true);
    });

    test("workspace contains health endpoint", () => {
      const srcFiles = findSourceFiles(result.workspace);
      const hasHealthEndpoint = srcFiles.some((file) => {
        const content = fs.readFileSync(file, "utf-8");
        return /['"]\/health['"]/.test(content) || /\.get\s*\(\s*['"]\/health/.test(content);
      });
      expect(hasHealthEndpoint).toBe(true);
    });

    test("response contains deployment links", () => {
      expect(hasDeployLinks(result.aggregate)).toBe(true);
    });
  });

  describe("regression detectors", () => {
    test("no secrets in generated code", () => {
      expect(countSecretsInCode(result.aggregate)).toBe(0);
    });

    test("no ACR admin credentials", () => {
      expect(countAcrAdminCredentialUsage(result.aggregate)).toBe(0);
    });

    test("GITHUB_TOKEN uses Key Vault", () => {
      expect(countMissingKeyVaultForToken(result.aggregate)).toBe(0);
    });

    test("correct session.on() pattern", () => {
      expect(countWrongSessionOnPattern(result.aggregate)).toBe(0);
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

    test("no inline HTML in TypeScript", () => {
      expect(countInlineHtmlInCode(result.aggregate)).toBe(0);
    });
  });
});
