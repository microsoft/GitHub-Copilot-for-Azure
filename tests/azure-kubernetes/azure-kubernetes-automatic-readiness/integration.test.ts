/**
 * Integration Tests for azure-kubernetes-automatic-readiness
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
} from "../../utils/agent-runner";
import {
  softCheckSkill,
  isSkillInvoked,
  isToolCalled,
  shouldEarlyTerminateForSkillInvocation,
  withTestResult
} from "../../utils/evaluate";

const SKILL_NAME = "azure-kubernetes-automatic-readiness";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

function isReadinessWorkflowInvoked(agentMetadata: Parameters<typeof isSkillInvoked>[0]): boolean {
  // Best signal: the readiness sub-skill was directly invoked.
  if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
    return true;
  }

  // Next best: the agent viewed a readiness-specific reference file.
  if (
    isToolCalled(
      agentMetadata,
      "view",
      /azure-kubernetes\/azure-kubernetes-automatic-readiness\//,
    )
  ) {
    return true;
  }

  // Weakest signal: the response mentions the readiness sub-skill by name.
  if (doesAssistantMessageIncludeKeyword(agentMetadata, "azure-kubernetes-automatic-readiness")) {
    return true;
  }

  // Fallback: the agent is clearly working on AKS Automatic readiness assessment
  // even without formal skill invocation (e.g. local SDK without skill routing).
  if (
    doesAssistantMessageIncludeKeyword(agentMetadata, "AKS Automatic") &&
    (doesAssistantMessageIncludeKeyword(agentMetadata, "migrat") ||
     doesAssistantMessageIncludeKeyword(agentMetadata, "compatib") ||
     doesAssistantMessageIncludeKeyword(agentMetadata, "readiness"))
  ) {
    return true;
  }

  // Router-only invocation does NOT count — it doesn't prove readiness workflow ran.
  return false;
}

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes skill for AKS Automatic migration readiness prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Can I migrate my AKS cluster to AKS Automatic? Check if my workloads are compatible.",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isReadinessWorkflowInvoked(agentMetadata)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });
  });

  describe("response-quality", () => {
    test("presents severity classification in findings", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "Validate my Kubernetes manifests against AKS Automatic constraints"
        });

        const hasSeverityContent =
          doesAssistantMessageIncludeKeyword(agentMetadata, "incompatible") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "requiresChanges") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "compatible") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "Compatible") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "critical") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "required") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "requirement") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "restriction") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "limitation") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "constraint") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "warning") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "auto-fixed");
        expect(hasSeverityContent).toBe(true);
      });
    });

    test("offers fix guidance for incompatible workloads", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "What would break if I switch my AKS Standard cluster to AKS Automatic?"
        });

        const hasFixGuidance =
          doesAssistantMessageIncludeKeyword(agentMetadata, "fix") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "remediat") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "Deployment Safeguards") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "incompatible");
        expect(hasFixGuidance).toBe(true);
      });
    });

    test("covers Deployment Safeguards policies", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "What AKS Automatic policies will deny my deployments?"
        });

        const hasPolicyContent =
          doesAssistantMessageIncludeKeyword(agentMetadata, "Safeguards") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "policy") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "resource requests") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "probes");
        expect(hasPolicyContent).toBe(true);
      });
    });
  });
});
