/**
 * Integration Tests for spring-apps-to-aca
 * 
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 * 
 * Run with: npm run test:integration -- --testPathPatterns=spring-apps-to-aca
 */

import {
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests
} from "../utils/agent-runner";
import { isSkillInvoked, softCheckSkill, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "spring-apps-to-aca";
const RUNS_PER_PROMPT = 5;
const INVOCATION_RATE_THRESHOLD = 0.8;
const NEGATIVE_INVOCATION_THRESHOLD = 0.2;

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_skill-invocation - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("Positive Invocation Tests", () => {
    test("invokes skill for Spring Boot to Container Apps migration", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "I want to migrate my Spring Boot application from Azure Spring Apps to Azure Container Apps. Can you help me with the assessment and deployment steps?",
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount += 1;
        }
      }
      const rate = invocationCount / RUNS_PER_PROMPT;
      setSkillInvocationRate(rate);
      expect(rate).toBeGreaterThanOrEqual(INVOCATION_RATE_THRESHOLD);
    }));

    test("invokes skill for Spring Boot containerization for ACA", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "Help me containerize my Spring Boot microservice and deploy it to Azure Container Apps",
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount += 1;
        }
      }
      const rate = invocationCount / RUNS_PER_PROMPT;
      setSkillInvocationRate(rate);
      expect(rate).toBeGreaterThanOrEqual(INVOCATION_RATE_THRESHOLD);
    }));
  });

  describe("Workflow Tests", () => {
    test("provides assessment guidance", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "What should I check before migrating my Spring Boot app from Azure Spring Apps to Container Apps?"
      });

      const hasAssessmentGuidance = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "assessment"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "pre-migration"
      );
      expect(hasAssessmentGuidance).toBe(true);
    }));

    test("provides containerization guidance", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "How do I containerize my Spring Boot application for Container Apps?"
      });

      const hasContainerizationGuidance = 
        doesAssistantMessageIncludeKeyword(agentMetadata, "Dockerfile") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "container") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "ACR");
      expect(hasContainerizationGuidance).toBe(true);
    }));

    test("provides deployment guidance", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "What are the steps to deploy my containerized Spring Boot app to Azure Container Apps?"
      });

      const hasDeploymentGuidance = 
        doesAssistantMessageIncludeKeyword(agentMetadata, "deploy") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "Container Apps");
      expect(hasDeploymentGuidance).toBe(true);
    }));
  });

  describe("Negative Invocation Tests", () => {
    test("does not trigger for generic Spring Boot questions (multi-trial)", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "How do I create a new Spring Boot project with Spring Initializr?",
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
        });

        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount += 1;
        }
      }
      const rate = invocationCount / RUNS_PER_PROMPT;
      setSkillInvocationRate(rate);
      expect(rate).toBeLessThanOrEqual(NEGATIVE_INVOCATION_THRESHOLD);
    }));

    test("does not trigger for AWS deployment questions (multi-trial)", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "How do I deploy Spring Boot to AWS Elastic Beanstalk?",
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
        });

        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount += 1;
        }
      }
      const rate = invocationCount / RUNS_PER_PROMPT;
      setSkillInvocationRate(rate);
      expect(rate).toBeLessThanOrEqual(NEGATIVE_INVOCATION_THRESHOLD);
    }));
  });
});
