/**
 * Integration Tests for entra-agent-id
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
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import {
  softCheckSkill,
  isSkillInvoked,
  shouldEarlyTerminateForSkillInvocation,
  withTestResult
} from "../utils/evaluate";
import {
  mentionsBlueprintCreation,
  mentionsBlueprintPrincipalStep,
  mentionsSponsorsBinding,
  mentionsAgentIdentityCreation,
  mentionsBlueprintBackreference,
  mentionsFmiPathExchange,
  recommendsSupportedAuth,
  mentionsPerAgentPermissionGrant
} from "./utils";

const SKILL_NAME = "entra-agent-id";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes entra-agent-id for Blueprint creation prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "How do I create a Microsoft Entra Agent Identity Blueprint and provision agent identities?",
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

    test("invokes entra-agent-id for runtime token exchange prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "Set up the fmi_path token exchange so each agent instance has a distinct Graph token",
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

    test("invokes entra-agent-id for SDK sidecar prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "Deploy the Microsoft Entra SDK for AgentID as a sidecar container for my Python agent",
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

    test("invokes entra-agent-id for Agent Identity Blueprint with sponsor prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "Create a new Microsoft Entra Agent Identity Blueprint with a user sponsor and its required BlueprintPrincipal",
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

    test("invokes entra-agent-id for per-instance Agent Identity creation prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "Register a new per-instance agent identity service principal under an existing Agent Identity Blueprint via Microsoft Graph",
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

    test("invokes entra-agent-id for OBO runtime authentication prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "Implement on-behalf-of token exchange so my agent can call Microsoft Graph as the signed-in user using its Agent Identity",
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

    test("invokes entra-agent-id for per-Agent-Identity permission grant prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "Grant User.Read.All application permission to a specific Agent Identity service principal, scoped per agent instance not to the BlueprintPrincipal",
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

    test("invokes entra-agent-id for AADSTS82001 troubleshooting prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "My Agent Identity token exchange is failing with AADSTS82001 — what is the correct grant type and fmi_path usage?",
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

  describe("content-assertion", () => {
    test("Blueprint creation prompt produces typed Graph endpoint, BlueprintPrincipal step, and sponsors@odata.bind", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Walk me through creating a Microsoft Entra Agent Identity Blueprint with a user sponsor using Microsoft Graph. Include the BlueprintPrincipal step and the exact request body shape."
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(mentionsBlueprintCreation(agentMetadata)).toBe(true);
      expect(mentionsBlueprintPrincipalStep(agentMetadata)).toBe(true);
      expect(mentionsSponsorsBinding(agentMetadata)).toBe(true);
    }));

    test("Per-instance Agent Identity prompt uses microsoft.graph.agentIdentity and references the parent Blueprint", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Show me the Microsoft Graph request to create a per-instance Agent Identity service principal under an existing Blueprint, including how to reference the Blueprint."
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(mentionsAgentIdentityCreation(agentMetadata)).toBe(true);
      expect(mentionsBlueprintBackreference(agentMetadata)).toBe(true);
    }));

    test("fmi_path exchange prompt describes the two-step exchange with client_credentials and /.default", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Show me the two-step fmi_path token exchange so an Agent Identity gets its own Microsoft Graph access token. Include the grant type and scopes."
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(mentionsFmiPathExchange(agentMetadata)).toBe(true);
    }));

    test("Auth guidance prompt steers toward client_credentials / Connect-MgGraph (not DefaultAzureCredential)", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "What credential should I use to call the Microsoft Entra Agent Identity APIs in Microsoft Graph?"
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(recommendsSupportedAuth(agentMetadata)).toBe(true);
    }));

    test("Permission grant prompt uses appRoleAssignments or oauth2PermissionGrants on the Agent Identity SP", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Grant User.Read.All application permission to a specific Agent Identity service principal."
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(mentionsPerAgentPermissionGrant(agentMetadata)).toBe(true);
    }));
  });
});
