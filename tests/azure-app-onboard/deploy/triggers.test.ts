/**
 * Trigger Tests for azure-app-onboard/deploy subskill
 *
 * Tests against the PARENT skill's TriggerMatcher — subskills don't
 * route independently. Validates that deploy-domain prompts trigger
 * the parent and sibling-domain prompts are distinguishable.
 */

import { TriggerMatcher } from "../../utils/trigger-matcher";
import { loadSkill, type LoadedSkill } from "../../utils/skill-loader";

const PARENT_SKILL = "azure-app-onboard";

describe(`${PARENT_SKILL}/deploy - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(PARENT_SKILL);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger (deploy-domain prompts via parent)", () => {
    const shouldTriggerPrompts: string[] = [
      "Deploy my app to Azure — the Terraform files are ready",
      "I have my infrastructure code ready, help me deploy to Azure",
      "Run the deployment for my Node.js app on Azure",
      "My Bicep files are generated, deploy them to my resource group",
      "Help me deploy all my services to Azure",
      "I want to deploy my new app to Azure",
    ];

    test.each(shouldTriggerPrompts)(
      'parent triggers on deploy prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.confidence).toBeGreaterThan(0);
      },
    );
  });

  describe("Should NOT Trigger (non-parent-domain prompts)", () => {
    const shouldNotTriggerPrompts: string[] = [
      // Generic negatives
      "What is the weather today?",
      "Help me write a poem about sunsets",
      "How do I configure an AWS Lambda function?",
      // Non-Azure negatives to avoid keyword matcher false positives
      "Explain quantum computing in simple terms",
      "Write a Python script to sort a list",
    ];

    test.each(shouldNotTriggerPrompts)(
      'parent does not trigger on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      },
    );
  });

  describe("Trigger Keywords Snapshot", () => {
    test("parent skill keywords match snapshot", () => {
      expect(triggerMatcher.getKeywords()).toMatchSnapshot();
    });
  });
});
