/**
 * Integration Tests for deploy-to-aks
 *
 * Tests skill behavior with a real Copilot agent session.
 * Requires Copilot CLI to be installed and authenticated.
 *
 * IMPORTANT: All test cases MUST be wrapped with `withTestResult` so that
 * pass/fail results and skill invocation rates are automatically recorded
 * to testResults.json after each test run.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 *
 * Run with: npm run test:integration -- --testPathPatterns=deploy-to-aks
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

const SKILL_NAME = "deploy-to-aks";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes skill for relevant prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "deploy my Node.js app to my existing AKS cluster",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount++;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });
  });

  describe("response-quality", () => {
    test("response contains expected keywords", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "deploy my Express.js API to AKS"
        });

        const hasExpectedContent = doesAssistantMessageIncludeKeyword(
          agentMetadata,
          "kubectl"
        );
        expect(hasExpectedContent).toBe(true);
      });
    });

    test("MCP tool calls are successful", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "deploy my app to AKS and check the deployment status"
        });

        const toolsSucceeded = areToolCallsSuccess(agentMetadata, "azure-documentation");
        expect(toolsSucceeded).toBe(true);
      });
    });

    test("works with project files", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            fs.writeFileSync(
              path.join(workspace, "package.json"),
              JSON.stringify({
                name: "my-api",
                version: "1.0.0",
                scripts: { start: "node dist/index.js", build: "tsc" },
                dependencies: { express: "^4.18.0" }
              }, null, 2)
            );
          },
          prompt: "containerize and deploy this Node.js app to my AKS cluster"
        });

        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
      });
    });
  });
});
