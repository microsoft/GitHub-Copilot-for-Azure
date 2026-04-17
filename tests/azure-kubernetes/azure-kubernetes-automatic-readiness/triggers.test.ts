/**
 * Trigger Tests for azure-kubernetes-automatic-readiness
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../utils/skill-loader";

const SKILL_NAME = "azure-kubernetes-automatic-readiness";
const SKILL_PATH = "azure-kubernetes/azure-kubernetes-automatic-readiness";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_PATH);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // Migration readiness
      "Can I migrate my cluster to AKS Automatic?",
      "Check my cluster readiness for AKS Automatic",
      "Assess my AKS cluster for Automatic compatibility",
      "Identify AKS Automatic migration blockers",
      "Is my workload compatible with AKS Automatic?",

      // Manifest validation
      "Validate this manifest against AKS Automatic constraints",
      "Will my Helm chart work on AKS Automatic?",
      "Check if my deployments are compatible with AKS Automatic",
      "Validate my Kubernetes manifests for AKS Automatic",

      // Fix requests
      "Fix my deployment for AKS Automatic compatibility",
      "How do I make my workloads work on AKS Automatic?",
      "My deployments fail on AKS Automatic, help me fix them",

      // Assessment
      "Run an AKS Automatic readiness assessment",
      "AKS Automatic migration assessment for my cluster",
      "Check Automatic compatibility for my namespace",
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
    const genericPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "Write a Python script to parse JSON",
      "How do I bake sourdough bread?",
      "Recommend a book about history",
      "What is the capital of France?",
    ];

    const otherCloudPrompts: string[] = [
      "How do I use AWS EKS?",
      "Help me with GCP GKE",
      "Set up EC2 instances",
    ];

    // Note: AKS-related prompts like "create an AKS cluster" or "debug AKS pods" also
    // match this skill's keywords — routing between azure-kubernetes, azure-diagnostics,
    // and this skill is handled by LLM reasoning from the SKILL.md content, not by the
    // keyword heuristic. Only truly unrelated prompts are testable here.

    const shouldNotTriggerPrompts = [
      ...genericPrompts,
      ...otherCloudPrompts,
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
});
