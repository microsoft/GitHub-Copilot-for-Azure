/**
 * Integration Tests for azure-local
 *
 * Tests skill behavior with a real Copilot agent session.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  useAgentRunner,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
} from "../utils/agent-runner";
import { isSkillInvoked, softCheckSkill, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "azure-local";
const RUNS_PER_PROMPT = 3;
const invocationRateThreshold = 0.8;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

function defineInvocationTest(
  agent: ReturnType<typeof useAgentRunner>,
  testLabel: string,
  prompt: string
) {
  test(testLabel, async () => {
    await withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt,
          shouldEarlyTerminate: (metadata) => isSkillInvoked(metadata, SKILL_NAME)
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount += 1;
        }
      }

      const rate = invocationCount / RUNS_PER_PROMPT;
      setSkillInvocationRate(rate);
      expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
    });
  });
}

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    defineInvocationTest(
      agent,
      "azure-local-deployment-planning",
      "Help me plan an Azure Local deployment and identify the prerequisites I need to check first."
    );

    defineInvocationTest(
      agent,
      "azure-local-update-readiness",
      "How should I assess Azure Local update readiness before scheduling a solution update?"
    );

    defineInvocationTest(
      agent,
      "azure-local-arc-vm-management",
      "How do I create and validate an Azure Local VM enabled by Azure Arc?"
    );
  });
});
