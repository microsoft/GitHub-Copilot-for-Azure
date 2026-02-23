/**
 * Integration Tests for azure-hosted-copilot-sdk
 *
 * Tests skill routing across 5 scenarios:
 * 1. Greenfield + explicit mention — no existing code, prompt says "copilot SDK"
 * 2. Existing app + add copilot SDK — Express app exists, prompt says "copilot SDK"
 * 3. Existing copilot SDK app + deploy — package.json has @github/copilot-sdk, prompt says "deploy"
 * 4. Existing copilot SDK app + modify — package.json has @github/copilot-sdk, prompt says "add feature"
 * 5. Explicit but vague — no existing code, prompt says "copilot-powered"
 *
 * Plus content-quality tests for output correctness.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  useAgentRunner,
  isSkillInvoked,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import {
  countSecretsInCode,
  countApiKeyInByomConfig
} from "../utils/regression-detectors";
import * as fs from "fs";
import * as path from "path";

const SKILL_NAME = "azure-hosted-copilot-sdk";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

// --- Workspace setup helpers ---

/** Base Express + TypeScript app (no copilot SDK) */
async function setupExpressApp(workspace: string): Promise<void> {
  fs.writeFileSync(path.join(workspace, "package.json"), JSON.stringify({
    name: "my-express-app",
    version: "1.0.0",
    dependencies: {
      "express": "^4.18.2",
      "@types/express": "^4.17.21",
      "typescript": "^5.3.3"
    },
    scripts: { build: "tsc", start: "node dist/server.js" }
  }, null, 2));
  fs.writeFileSync(path.join(workspace, "server.ts"), `
import express from 'express';
const app = express();
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(3000, () => console.log('Running on :3000'));
`);
  fs.writeFileSync(path.join(workspace, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "NodeNext", outDir: "dist", strict: true }
  }, null, 2));
}

/** Express + TypeScript app WITH @github/copilot-sdk already installed */
async function setupCopilotSdkApp(workspace: string): Promise<void> {
  fs.writeFileSync(path.join(workspace, "package.json"), JSON.stringify({
    name: "copilot-review-app",
    version: "1.0.0",
    dependencies: {
      "@github/copilot-sdk": "^0.1.22",
      "express": "^4.18.2",
      "@types/express": "^4.17.21",
      "typescript": "^5.3.3"
    },
    scripts: { build: "tsc", start: "node dist/server.js" }
  }, null, 2));
  fs.writeFileSync(path.join(workspace, "server.ts"), `
import express from 'express';
import { CopilotClient } from '@github/copilot-sdk';
const app = express();
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.post('/review', async (req, res) => {
  const client = new CopilotClient();
  const session = await client.createSession();
  const result = await session.sendAndWait(req.body.prompt);
  res.json({ review: result });
});
app.listen(3000, () => console.log('Running on :3000'));
`);
  fs.writeFileSync(path.join(workspace, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "NodeNext", outDir: "dist", strict: true }
  }, null, 2));
}

// --- Invocation rate helper ---

function logRate(label: string, successCount: number): number {
  const rate = successCount / RUNS_PER_PROMPT;
  console.log(`${SKILL_NAME} invocation rate for ${label}: ${(rate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
  fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for ${label}: ${(rate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
  return rate;
}

async function measureInvocationRate(
  agent: ReturnType<typeof useAgentRunner>,
  config: { prompt: string; setup?: (workspace: string) => Promise<void> },
  label: string
): Promise<number> {
  let successCount = 0;
  for (let i = 0; i < RUNS_PER_PROMPT; i++) {
    try {
      const metadata = await agent.run(config);
      if (isSkillInvoked(metadata, SKILL_NAME)) {
        successCount++;
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  SDK not loadable, skipping remaining runs");
        return -1; // signal to skip assertion
      }
      throw e;
    }
  }
  return logRate(label, successCount);
}

// --- Tests ---

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {

    // Scenario 1: Greenfield + explicit SDK mention
    test("greenfield: invokes skill when prompt mentions copilot SDK", async () => {
      const rate = await measureInvocationRate(agent, {
        prompt: "Build an Azure app that uses the Copilot SDK to brutally review GitHub repos based on user input",
      }, "greenfield-explicit");
      if (rate >= 0) expect(rate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, 600000);

    // Scenario 2: Existing app + "add copilot SDK" (no copilot SDK in codebase yet)
    test("existing app: invokes skill when adding copilot SDK to Express app", async () => {
      const rate = await measureInvocationRate(agent, {
        setup: setupExpressApp,
        prompt: "Add a Copilot SDK agent to my existing Express app that reviews code",
      }, "existing-add-sdk");
      if (rate >= 0) expect(rate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, 600000);

    // Scenario 3: Existing copilot SDK app + deploy (NO SDK keyword in prompt)
    test("existing copilot SDK app: invokes skill for deploy prompt via codebase scan", async () => {
      const rate = await measureInvocationRate(agent, {
        setup: setupCopilotSdkApp,
        prompt: "Deploy this app to Azure",
      }, "existing-sdk-deploy");
      if (rate >= 0) expect(rate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, 600000);

    // Scenario 4: Existing copilot SDK app + modify (NO SDK keyword in prompt)
    test("existing copilot SDK app: invokes skill for modify prompt via codebase scan", async () => {
      const rate = await measureInvocationRate(agent, {
        setup: setupCopilotSdkApp,
        prompt: "Add a new feature to this app that summarizes pull requests",
      }, "existing-sdk-modify");
      if (rate >= 0) expect(rate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, 600000);

    // Scenario 5: Greenfield + vague copilot mention
    test("greenfield: invokes skill for vague copilot-powered prompt", async () => {
      const rate = await measureInvocationRate(agent, {
        prompt: "Help me set up a copilot-powered Azure app that does code review",
      }, "greenfield-vague");
      if (rate >= 0) expect(rate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, 600000);
  });

  describe("content-quality", () => {
    test("greenfield scaffold mentions copilot SDK templates", async () => {
      const agentMetadata = await agent.run({
        prompt: "Scaffold a copilot-powered app using the copilot SDK and deploy it to Azure",
        nonInteractive: true,
      });

      const mentionsTemplate = doesAssistantMessageIncludeKeyword(agentMetadata, "copilot-sdk-service") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "copilot-sdk") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "Copilot SDK");
      expect(mentionsTemplate).toBe(true);
      expect(countSecretsInCode(agentMetadata)).toBe(0);
    }, 600000);

    test("BYOM prompt mentions DefaultAzureCredential", async () => {
      const agentMetadata = await agent.run({
        prompt: "Build a copilot SDK app with BYOM using my Azure model and DefaultAzureCredential for auth",
        nonInteractive: true,
      });

      const mentionsByom = doesAssistantMessageIncludeKeyword(agentMetadata, "DefaultAzureCredential") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "bearerToken") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "provider");
      expect(mentionsByom).toBe(true);
      expect(countApiKeyInByomConfig(agentMetadata)).toBe(0);
    }, 600000);

    test("existing copilot SDK app deploy uses correct SDK patterns", async () => {
      const agentMetadata = await agent.run({
        setup: setupCopilotSdkApp,
        prompt: "Deploy this app to Azure",
        nonInteractive: true,
      });

      const mentionsSdk = doesAssistantMessageIncludeKeyword(agentMetadata, "copilot-sdk") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "Copilot SDK") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "copilot-sdk-service") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "CopilotClient");
      expect(mentionsSdk).toBe(true);
      expect(countSecretsInCode(agentMetadata)).toBe(0);
    }, 600000);
  });
});
