/**
 * Trigger Tests for azure-ai
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-ai";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger - AI Search", () => {
    const aiSearchPrompts: string[] = [
      "How do I set up Azure AI Search?",
      "Configure vector search in Azure",
      "Implement hybrid search with Azure AI Search",
      "Query my Azure search index",
      "Create a search index for semantic search",
      "How to use AI Search for full-text search?",
    ];

    test.each(aiSearchPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should Trigger - Speech", () => {
    const speechPrompts: string[] = [
      "Convert speech to text with Azure",
      "How do I use Azure text-to-speech?",
      "Transcribe audio using Azure Speech",
      "Set up speech recognition in Azure",
      "Convert text to speech using Azure AI",
      "Implement real-time transcription with Azure",
    ];

    test.each(speechPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should Trigger - Document Intelligence", () => {
    const otherAIPrompts: string[] = [
      "Extract text from documents using Azure OCR",
      "How do I use Document Intelligence in Azure?",
      "Set up form extraction with Azure",
    ];

    test.each(otherAIPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "Set up AWS SageMaker",
      "Use Google Cloud Speech API",
      "Configure Elasticsearch for my app",
      "Help me configure nginx for load balancing",
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
      const longPrompt = "Azure AI Search vector hybrid speech transcribe ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive for Azure AI terms", () => {
      const result1 = triggerMatcher.shouldTrigger("AZURE AI SEARCH");
      const result2 = triggerMatcher.shouldTrigger("azure ai search");
      expect(result1.triggered).toBe(result2.triggered);
    });

    test("distinguishes between AI services and other Azure services", () => {
      const aiResult = triggerMatcher.shouldTrigger("Create an Azure AI Search index");
      // AI Search should trigger
      expect(aiResult.triggered).toBe(true);
    });
  });
});
