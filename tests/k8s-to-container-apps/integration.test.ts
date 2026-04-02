/**
 * Integration Tests for k8s-to-container-apps
 * 
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 */

import {
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests
} from "../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "k8s-to-container-apps";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes skill for k8s to ACA migration prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "I want to migrate my Kubernetes workloads from GKE to Azure Container Apps. Can you help me assess compatibility and create a migration plan?",
            nonInteractive: true,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
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

    test("invokes skill for k8s manifest conversion", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "How do I convert my Kubernetes deployment manifests to Azure Container Apps configuration?",
            nonInteractive: true,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
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

  describe("workflow-execution", () => {
    test("provides migration assessment guidance", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "I need to migrate a Kubernetes cluster from EKS to Azure Container Apps. What should I check first?",
          nonInteractive: true,
        });

        const invoked = isSkillInvoked(agentMetadata, SKILL_NAME);
        expect(invoked).toBe(true);

        const hasAssessmentGuidance = doesAssistantMessageIncludeKeyword(agentMetadata, "assess") ||
                                      doesAssistantMessageIncludeKeyword(agentMetadata, "compatibility") ||
                                      doesAssistantMessageIncludeKeyword(agentMetadata, "StatefulSet") ||
                                      doesAssistantMessageIncludeKeyword(agentMetadata, "DaemonSet");
        expect(hasAssessmentGuidance).toBe(true);
      });
    });

    test("mentions both assessment and deployment guides", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "Walk me through migrating my k8s workloads to Azure Container Apps",
          nonInteractive: true,
        });

        const invoked = isSkillInvoked(agentMetadata, SKILL_NAME);
        expect(invoked).toBe(true);

        const mentionsGuides = doesAssistantMessageIncludeKeyword(agentMetadata, "assessment") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "deployment") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "export") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "migrate");
        expect(mentionsGuides).toBe(true);
      });
    });

    test("discusses ACR migration for container images", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "How do I migrate my container images from my current registry to Azure for my k8s migration?",
          nonInteractive: true,
        });

        const invoked = isSkillInvoked(agentMetadata, SKILL_NAME);
        expect(invoked).toBe(true);

        const hasACRGuidance = doesAssistantMessageIncludeKeyword(agentMetadata, "ACR") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "Azure Container Registry") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "az acr import") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "image");
        expect(hasACRGuidance).toBe(true);
      });
    });
  });

  describe("negative-cases", () => {
    test("does NOT invoke for new Container Apps deployment", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "I want to deploy a new application to Azure Container Apps",
            nonInteractive: true,
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount++;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        // For negative cases, expect invocation rate to be low (≤20%)
        expect(rate).toBeLessThanOrEqual(0.2);
      });
    });

    test("does NOT invoke for AKS cluster management", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "How do I scale my AKS cluster nodes?",
            nonInteractive: true,
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount++;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        // For negative cases, expect invocation rate to be low (≤20%)
        expect(rate).toBeLessThanOrEqual(0.2);
      });
    });
  });
});
