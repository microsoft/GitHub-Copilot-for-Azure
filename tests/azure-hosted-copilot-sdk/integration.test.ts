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
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import {
  countSecretsInCode,
  countApiKeyInByomConfig
} from "../utils/regression-detectors";
import {
  setupExpressApp,
  setupCopilotSdkApp,
  measureInvocationRate,
  sanitizeMetadata,
} from "./util";

const SKILL_NAME = "azure-hosted-copilot-sdk";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate
const TEST_TIMEOUT = 600_000; // 10 minutes per test

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

// --- Tests ---

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {

    // Scenario 1: Greenfield + explicit SDK mention
    test("greenfield: invokes skill when prompt mentions copilot SDK", async () => {
      const rate = await measureInvocationRate(agent, SKILL_NAME, {
        prompt: "Build an Azure app that uses the Copilot SDK to brutally review GitHub repos based on user input",
      }, "greenfield-explicit", RUNS_PER_PROMPT);
      if (rate >= 0) expect(rate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, TEST_TIMEOUT);

    // Scenario 2: Existing app + "add copilot SDK" (no copilot SDK in codebase yet)
    test("existing app: invokes skill when adding copilot SDK to Express app", async () => {
      const rate = await measureInvocationRate(agent, SKILL_NAME, {
        setup: setupExpressApp,
        prompt: "Add a Copilot SDK agent to my existing Express app that reviews code",
      }, "existing-add-sdk", RUNS_PER_PROMPT);
      if (rate >= 0) expect(rate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, TEST_TIMEOUT);

    // Scenario 3: Existing copilot SDK app + deploy (NO SDK keyword in prompt)
    test("existing copilot SDK app: invokes skill for deploy prompt via codebase scan", async () => {
      const rate = await measureInvocationRate(agent, SKILL_NAME, {
        setup: setupCopilotSdkApp,
        prompt: "Deploy this app to Azure",
      }, "existing-sdk-deploy", RUNS_PER_PROMPT);
      if (rate >= 0) expect(rate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, TEST_TIMEOUT);

    // Scenario 4: Existing copilot SDK app + modify (NO SDK keyword in prompt)
    test("existing copilot SDK app: invokes skill for modify prompt via codebase scan", async () => {
      const rate = await measureInvocationRate(agent, SKILL_NAME, {
        setup: setupCopilotSdkApp,
        prompt: "Add a new feature to this app that summarizes pull requests",
      }, "existing-sdk-modify", RUNS_PER_PROMPT);
      if (rate >= 0) expect(rate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, TEST_TIMEOUT);

    // Scenario 5: Greenfield + vague copilot mention
    test("greenfield: invokes skill for vague copilot-powered prompt", async () => {
      const rate = await measureInvocationRate(agent, SKILL_NAME, {
        prompt: "Help me set up a copilot-powered Azure app that does code review",
      }, "greenfield-vague", RUNS_PER_PROMPT);
      if (rate >= 0) expect(rate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, TEST_TIMEOUT);
  });

  describe("content-quality", () => {
    test("greenfield scaffold mentions copilot SDK templates", async () => {
      const rawMetadata = await agent.run({
        prompt: "Scaffold a copilot-powered app using the copilot SDK and deploy it to Azure",
        nonInteractive: true,
      });
      const agentMetadata = sanitizeMetadata(rawMetadata);

      const mentionsTemplate = doesAssistantMessageIncludeKeyword(agentMetadata, "copilot-sdk-service") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "copilot-sdk") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "Copilot SDK");
      expect(mentionsTemplate).toBe(true);
      // Run regression detector on raw metadata so redaction doesn't mask leaks
      expect(countSecretsInCode(rawMetadata)).toBe(0);
    }, TEST_TIMEOUT);

    test("BYOM prompt mentions DefaultAzureCredential", async () => {
      const rawMetadata = await agent.run({
        prompt: "Build a copilot SDK app with BYOM using my Azure model and DefaultAzureCredential for auth",
        nonInteractive: true,
      });
      const agentMetadata = sanitizeMetadata(rawMetadata);

      const mentionsByom = doesAssistantMessageIncludeKeyword(agentMetadata, "DefaultAzureCredential") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "bearerToken") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "provider");
      expect(mentionsByom).toBe(true);
      // Run regression detector on raw metadata so redaction doesn't mask leaks
      expect(countApiKeyInByomConfig(rawMetadata)).toBe(0);
    }, TEST_TIMEOUT);

    test("existing copilot SDK app deploy uses correct SDK patterns", async () => {
      const rawMetadata = await agent.run({
        setup: setupCopilotSdkApp,
        prompt: "Deploy this app to Azure",
        nonInteractive: true,
      });
      const agentMetadata = sanitizeMetadata(rawMetadata);

      const mentionsSdk = doesAssistantMessageIncludeKeyword(agentMetadata, "copilot-sdk") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "Copilot SDK") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "copilot-sdk-service") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "CopilotClient");
      expect(mentionsSdk).toBe(true);
      // Run regression detector on raw metadata so redaction doesn't mask leaks
      expect(countSecretsInCode(rawMetadata)).toBe(0);
    }, TEST_TIMEOUT);
  });
});
