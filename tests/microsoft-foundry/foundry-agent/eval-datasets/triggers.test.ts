/**
 * Trigger Tests for eval-datasets
 */

import { TriggerMatcher } from "../../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe("eval-datasets - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Create a dataset from my Foundry agent traces",
      "Refresh my local Foundry dataset cache",
      "Version my evaluation dataset for a Foundry agent",
      "Detect regressions using my Foundry test datasets",
      "Curate trace candidates into a dataset for Azure AI Foundry",
    ];

    test.each(shouldTriggerPrompts)('triggers on: "%s"', (prompt) => {
      const result = triggerMatcher.shouldTrigger(prompt);
      expect(result.triggered).toBe(true);
      expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Explain how Kubernetes pods work",
      "Build me a React dashboard",
      "Set up PostgreSQL backups",
    ];

    test.each(shouldNotTriggerPrompts)('does not trigger on: "%s"', (prompt) => {
      const result = triggerMatcher.shouldTrigger(prompt);
      expect(result.triggered).toBe(false);
    });
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
});
