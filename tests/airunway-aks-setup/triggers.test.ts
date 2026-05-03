import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "airunway-aks-setup";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // Direct AI Runway references
      "How do I set up AI Runway on my AKS cluster?",
      "Install AI Runway on Kubernetes",
      "I want to deploy my first model with AI Runway",
      "How do I onboard my AKS cluster to AI Runway?",
      "Setup inference on AKS",
      "Get started with AI Runway",
      "airunway setup on my cluster",

      // Intent-based (don't name AI Runway directly)
      "I want to run an LLM on my AKS cluster",
      "Deploy a model to Kubernetes with GPU support",
      "How do I set up GPU inference on AKS?",
      "Configure KAITO on my AKS cluster",
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
    // Generic prompts unrelated to AI/Kubernetes
    const genericPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
    ];

    // Competing cloud providers — verify these don't fire despite similar Kubernetes terminology
    const otherCloudPrompts: string[] = [
      "Help me with AWS EKS",
      "Deploy to GCP GKE",
    ];

    // Azure-branded terms alone should not trigger — only AKS + inference/model context should
    const wrongDomainPrompts: string[] = [
      "Help me set up Azure Functions",
      "Create an Azure SQL database",
      "Set up Azure Key Vault for my app",
    ];

    // Near-misses: related concepts but different intent
    // Note: AKS-specific near-misses (e.g., "Scale my AKS node pool") share too
    // many keywords with this skill for keyword-level matching. Those are tested
    // via integration tests where the LLM makes the triggering decision.
    const nearMissPrompts: string[] = [
      "How do I set up Azure DevOps pipelines for my app?",
      "Migrate my on-premises database to Azure",
      "How do I set up CI/CD for my Azure web app?",
      "What are the best practices for Azure networking?",
      "Help me write a Terraform module for Azure VMs",
    ];

    const shouldNotTriggerPrompts = [
      ...genericPrompts,
      ...otherCloudPrompts,
      ...wrongDomainPrompts,
      ...nearMissPrompts,
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
      const longPrompt = "Azure ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("ai runway setup");
      const result2 = triggerMatcher.shouldTrigger("AI RUNWAY SETUP");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
