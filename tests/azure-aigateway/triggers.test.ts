/**
 * Trigger Tests for azure-aigateway
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-aigateway";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // AI Gateway setup
      "Set up an AI Gateway for my Azure OpenAI models",
      "Configure Azure API Management as a gateway for my AI models",
      "Add a gateway to my MCP server",
      "Set up APIM for my AI workloads",
      // Rate limiting and token limits
      "Add rate limiting to my model requests",
      "Limit tokens for my AI API",
      "How do I ratelimit my MCP server?",
      // Semantic caching
      "Enable semantic caching for my AI API",
      "Set up semantic cache for Azure OpenAI in APIM",
      // Content safety
      "Add content safety to my AI endpoint",
      "Protect my AI model with content filtering",
      // Load balancing
      "Load balance across multiple AI backends",
      // OpenAPI import
      "Import API from OpenAPI spec into APIM",
      "Add API to APIM gateway from OpenAPI",
      // MCP conversion
      "Convert my API to MCP server",
      "Set up MCP server in API Management",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      // Unrelated topics
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      // Wrong cloud provider
      "Set up AWS API Gateway",
      "Configure Google Cloud Endpoints",
      // Databases (azure-postgres)
      "Set up a PostgreSQL database",
      "Create a Cosmos DB instance",
      // Unrelated Azure services
      "Create a storage account",
      "Set up a virtual network",
    ];

    test.each(shouldNotTriggerPrompts)(
      'does not trigger on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      }
    );
  });

  describe("Trigger Keywords Snapshot", () => {
    test("skill keywords match snapshot", () => {
      expect(triggerMatcher.getKeywords()).toMatchSnapshot();
    });

    test("skill description triggers match snapshot", () => {
      expect({
        name: skill.metadata.name,
        description: skill.metadata.description,
        extractedKeywords: triggerMatcher.getKeywords()
      }).toMatchSnapshot();
    });
  });

  describe("Edge Cases", () => {
    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });

    test("handles very long prompt", () => {
      const longPrompt = "AI Gateway ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive for gateway terms", () => {
      const result1 = triggerMatcher.shouldTrigger("set up APIM gateway");
      const result2 = triggerMatcher.shouldTrigger("set up apim GATEWAY");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
