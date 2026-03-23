/**
 * Integration Tests for {SKILL_NAME}
 * 
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 * 
 * IMPORTANT: All test cases MUST be wrapped with `withTestResult` so that
 * pass/fail results and skill invocation rates are automatically recorded
 * to testResults.json after each test run.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 
 * Run with: npm run test:integration -- --testPathPatterns={skill-name}
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  useAgentRunner,
  areToolCallsSuccess,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests
} from "../utils/agent-runner";
import { isSkillInvoked, softCheckSkill, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";

// Replace with your skill name
const SKILL_NAME = "your-skill-name";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

// Use centralized skip logic from agent-runner
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  // ──────────────────────────────────────────────────────────────────
  // Pattern 1: Skill invocation rate test (with setSkillInvocationRate)
  //
  // Use this when running the same prompt multiple times to measure
  // how reliably the skill gets invoked.
  // ──────────────────────────────────────────────────────────────────
  describe("skill-invocation", () => {
    test("invokes skill for relevant prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Your test prompt that should trigger this skill",
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
    }));
  });

  // ──────────────────────────────────────────────────────────────────
  // Pattern 2: Simple assertion test (no invocation rate)
  //
  // Use this for single-run tests that check response content,
  // tool calls, or other non-rate assertions.
  // ──────────────────────────────────────────────────────────────────
  describe("response-quality", () => {
    test("response contains expected keywords", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Your test prompt here"
      });

      const hasExpectedContent = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "expected keyword"
      );
      expect(hasExpectedContent).toBe(true);
    }));

    test("MCP tool calls are successful", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Your test prompt that uses Azure tools"
      });

      const toolsSucceeded = areToolCallsSuccess(agentMetadata, "azure-documentation");
      expect(toolsSucceeded).toBe(true);
    }));

    // Example test with workspace setup
    test("works with project files", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          fs.writeFileSync(
            path.join(workspace, "example.json"),
            JSON.stringify({ key: "value" })
          );
        },
        prompt: "Your test prompt that needs workspace files"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }));
  });
});
