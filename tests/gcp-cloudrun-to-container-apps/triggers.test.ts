/**
 * Trigger Tests for gcp-cloudrun-to-container-apps
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "gcp-cloudrun-to-container-apps";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "migrate Cloud Run to Container Apps",
      "migrate Cloud Run to Azure",
      "convert Cloud Run services to ACA",
      "move from Cloud Run to Azure Container Apps",
      "Cloud Run to ACA migration assessment",
      "migrate GCP Cloud Run workloads to Azure",
      "assess Cloud Run to Container Apps migration",
      "I want to migrate my Cloud Run service to Azure",
      "help me move from Google Cloud Run to Container Apps",
      "convert my Cloud Run deployment to Azure Container Apps",
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
      "What is the weather today?",
      "Help me write a poem",
      "How do I write a Python function?",
      "Explain quantum computing",
      "What is the capital of France?",
      "Debug my JavaScript code",
    ];

    test.each(shouldNotTriggerPrompts)(
      'does NOT trigger on: "%s"',
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

  describe("Trigger Configuration", () => {
    test("has clear activation triggers in description", () => {
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
      expect(description).toMatch(/Cloud Run/i);
    });

    test("includes DO NOT USE FOR clause", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR");
    });
  });
});
