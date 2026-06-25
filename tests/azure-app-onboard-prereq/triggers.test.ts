import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-app-onboard-prereq";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  test("skill loads with valid metadata", () => {
    expect(skill.metadata.name).toBe(SKILL_NAME);
    expect(skill.metadata.description).toBeTruthy();
    expect(skill.content.length).toBeGreaterThan(0);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // Direct WHEN-clause phrases from the description
      "Evaluate my repo for Azure deployment readiness",
      "Is my app ready to deploy to Azure?",
      "What does my app need to deploy?",
      "What do I need before deploying to Azure?",
      "Can I ship this to Azure?",
      "Scan my repo for issues before deployment",
      "Is this app deployable to Azure?",
      "Check if my app is ready for Azure",
      "Do I need a Dockerfile for Azure deployment?",
      // Natural variations
      "Check if my repo is ready to deploy to Azure",
      "Does my app need anything before I can deploy it?",
      "Are there any blockers preventing my app from deploying?",
      "What prerequisites does my project need for Azure?",
      "Assess whether my source code is ready for Azure deployment",
      "Evaluate my repository for build health and completeness",
      "Can you scan my code and tell me if it's deployable?",
      "What frameworks and dependencies does my app need for Azure?",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.confidence).toBeGreaterThan(0);
      },
    );
  });

  describe("Should NOT Trigger", () => {
    // Generic non-Azure prompts — avoid Azure/deploy keywords that false-positive
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem about sunsets",
      "Explain quantum computing in simple terms",
      "How do I configure an AWS Lambda function?",
      "Set up a GCP Cloud Run service",
      "Write a Python script to sort a list",
      "What is the capital of France?",
      "What is the best recipe for chocolate cake?",
      "Calculate the fibonacci sequence",
    ];

    test.each(shouldNotTriggerPrompts)(
      'does not trigger on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      },
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
        extractedKeywords: triggerMatcher.getKeywords(),
      }).toMatchSnapshot();
    });
  });

  describe("Edge Cases", () => {
    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });

    test("handles very long prompt", () => {
      const longPrompt = "Azure ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const prompt = "evaluate my repo for Azure deployment readiness";
      const result1 = triggerMatcher.shouldTrigger(prompt.toLowerCase());
      const result2 = triggerMatcher.shouldTrigger(prompt.toUpperCase());
      expect(result1.triggered).toBe(true);
      expect(result2.triggered).toBe(true);
    });
  });
});
