import * as fs from "node:fs";
import * as path from "node:path";
import {
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { isSkillInvoked, softCheckSkill, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "airunway-aks-setup";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  // Log skip reason to help diagnose CI environment issues (e.g. missing SDK auth)
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  async function measureInvocationRate(prompt: string): Promise<number> {
    let invocationCount = 0;
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      const agentMetadata = await agent.run({
        prompt,
        shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
      });
      softCheckSkill(agentMetadata, SKILL_NAME);
      if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
        invocationCount += 1;
      }
    }
    return invocationCount / RUNS_PER_PROMPT;
  }

  describe("skill-invocation", () => {
    test("invokes skill for AI Runway setup prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const rate = await measureInvocationRate("How do I set up AI Runway on my AKS cluster?");
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes skill for model deployment prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const rate = await measureInvocationRate("I want to deploy Llama on my AKS cluster with GPUs");
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes skill for GPU inference setup prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const rate = await measureInvocationRate("How do I set up GPU inference on my AKS cluster to run LLMs?");
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });
  });

  describe("response-quality", () => {
    test("response mentions controller installation steps", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "Walk me through installing the AI Runway controller on my AKS cluster."
        });

        const hasControllerContent = doesAssistantMessageIncludeKeyword(agentMetadata, "controller") ||
                                     doesAssistantMessageIncludeKeyword(agentMetadata, "make") ||
                                     doesAssistantMessageIncludeKeyword(agentMetadata, "CRD");
        expect(hasControllerContent).toBe(true);
      });
    });

    test("response covers GPU assessment guidance", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "My AKS cluster has T4 GPUs — what do I need to know before deploying a model with AI Runway?"
        });

        const hasGPUContent = doesAssistantMessageIncludeKeyword(agentMetadata, "float16") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "bfloat16") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "T4") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "dtype");
        expect(hasGPUContent).toBe(true);
      });
    });

    test("response recommends a starter model for an A10G cluster", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "Which model should I deploy first on an AKS cluster with a single A10G GPU using AI Runway?"
        });

        const hasModelContent = doesAssistantMessageIncludeKeyword(agentMetadata, "Llama") ||
                                doesAssistantMessageIncludeKeyword(agentMetadata, "Phi") ||
                                doesAssistantMessageIncludeKeyword(agentMetadata, "KAITO");
        expect(hasModelContent).toBe(true);
      });
    });

    test("response explains ModelDeployment CR for first deployment", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "How do I deploy a model with AI Runway? Show me the Kubernetes resource I need to apply."
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        const hasCRContent = doesAssistantMessageIncludeKeyword(agentMetadata, "ModelDeployment") ||
                             doesAssistantMessageIncludeKeyword(agentMetadata, "kubectl apply") ||
                             doesAssistantMessageIncludeKeyword(agentMetadata, "airunway.ai");
        expect(hasCRContent).toBe(true);
      });
    });

    test("works with a kubeconfig in the workspace", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            fs.writeFileSync(
              path.join(workspace, "kubeconfig.yaml"),
              `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://my-aks-cluster.hcp.eastus.azmk8s.io
  name: my-aks-cluster
contexts:
- context:
    cluster: my-aks-cluster
    user: clusterUser
  name: my-aks-cluster
current-context: my-aks-cluster
users:
- name: clusterUser
`
            );
          },
          prompt: "I have a kubeconfig in the workspace — set up AI Runway on this cluster."
        });

        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
      });
    });
  });
});
