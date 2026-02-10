/**
 * Integration Tests for ghcp-sdk-deploy
 *
 * Scenario 1: User says "Build a repo quality rater with the Copilot SDK" and
 * the skill handles all scaffolding, SSE config, and Azure deployment.
 *
 * Multi-turn prompt flow:
 *   1. Build a repo quality rater with the Copilot SDK — deploy to Azure
 *   2. Add Key Vault secrets and /health endpoint
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
  countAcrAdminCredentialUsage,
  countMissingKeyVaultForToken,
  countWrongSessionOnPattern,
  countInlineHtmlInCode,
} from "../utils/regression-detectors";

const SKILL_NAME = "ghcp-sdk-deploy";

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
        nonInteractive: true,
        preserveWorkspace: true,
        maxTurns: MAX_TURNS,
        maxDeployAttempts: MAX_DEPLOY_ATTEMPTS,
        prompts: [
          {
            label: "Canonical demo — repo quality rater",
            prompt:
              "Build a repo quality rater with the Copilot SDK — analyze code and give a 5-star rating. Deploy to Azure.",
          },
          {
            label: "Secrets + health check",
            prompt:
              "Add Key Vault for the GITHUB_TOKEN secret, set COPILOT_AGENT_URL to the deployed endpoint, and make sure there's a /health endpoint.",
          },
          {
            label: "Add AI Foundry backend",
            prompt:
              "Add an Azure AI Foundry OpenAI backend with GPT-4o using managed identity and wire it into the agent.",
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
      expect(fs.existsSync(path.join(result.workspace, "package.json"))).toBe(true);
    });

    test("workspace contains health endpoint", () => {
      // Find the main app source file and check for /health route
      const srcFiles = findSourceFiles(result.workspace);
      const hasHealthEndpoint = srcFiles.some((file) => {
        const content = fs.readFileSync(file, "utf-8");
        return /['"]\/health['"]/.test(content) || /\.get\s*\(\s*['"]\/health/.test(content);
      });
      expect(hasHealthEndpoint).toBe(true);
    });

    test("workspace contains Dockerfile", () => {
      const hasDockerfile = findFiles(result.workspace, "Dockerfile").length > 0;
      expect(hasDockerfile).toBe(true);
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

    test("no ACR admin credentials", () => {
      expect(countAcrAdminCredentialUsage(result.aggregate)).toBe(0);
    });

    test("GITHUB_TOKEN uses Key Vault", () => {
      expect(countMissingKeyVaultForToken(result.aggregate)).toBe(0);
    });

    test("correct session.on() pattern", () => {
      expect(countWrongSessionOnPattern(result.aggregate)).toBe(0);
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

    test("no inline HTML in TypeScript", () => {
      expect(countInlineHtmlInCode(result.aggregate)).toBe(0);
    });
  });
});
