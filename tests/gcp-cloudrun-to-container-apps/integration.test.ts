/**
 * Integration Tests for gcp-cloudrun-to-container-apps
 * 
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 */

import {
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests
} from "../utils/agent-runner";
import { isSkillInvoked, softCheckSkill, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "gcp-cloudrun-to-container-apps";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_skill-invocation - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes skill for Cloud Run to ACA migration prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "I need to migrate my Google Cloud Run service to Azure Container Apps. Can you help me assess the migration and plan the steps?",
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount += 1;
        }
      }
      const rate = invocationCount / RUNS_PER_PROMPT;
      setSkillInvocationRate(rate);
      expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
    }));

    test("invokes skill for Cloud Run service conversion", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "How do I convert my Cloud Run services to Azure Container Apps?",
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount += 1;
        }
      }
      const rate = invocationCount / RUNS_PER_PROMPT;
      setSkillInvocationRate(rate);
      expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
    }));
  });

  describe("workflow-execution", () => {
    test("provides migration assessment guidance", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "I have a Cloud Run service on GCP and want to assess if it can be migrated to Azure Container Apps"
      });

      const hasAssessmentGuidance = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "assessment"
      );
      expect(hasAssessmentGuidance).toBe(true);
    }));

    test("mentions assessment or deployment process", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Help me migrate my Cloud Run workload to Azure Container Apps. What's the process?"
      });

      const hasAssessment = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "assess"
      );
      const hasDeployment = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "deploy"
      );
      const hasGuide = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "guide"
      );
      expect(hasAssessment || hasDeployment || hasGuide).toBe(true);
    }));

    test("discusses ACR migration for container images", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "My Cloud Run service uses images from Google Container Registry. How do I migrate them to Azure?"
      });

      const mentionsACR = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "ACR"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "Container Registry"
      );
      expect(mentionsACR).toBe(true);
    }));
  });

  describe("negative-cases", () => {
    test("does NOT invoke for new Container Apps deployment", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "I want to deploy a new containerized application to Azure Container Apps",
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
        });

        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount += 1;
        }
      }
      const rate = invocationCount / RUNS_PER_PROMPT;
      setSkillInvocationRate(rate);
      expect(rate).toBeLessThan(0.5); // Should NOT invoke
    }));

    test("does NOT invoke for general GCP to Azure migration", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "I need to migrate my entire GCP infrastructure to Azure",
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
        });

        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount += 1;
        }
      }
      const rate = invocationCount / RUNS_PER_PROMPT;
      setSkillInvocationRate(rate);
      expect(rate).toBeLessThan(0.5); // Should NOT invoke (use azure-cloud-migrate)
    }));
  });
});
