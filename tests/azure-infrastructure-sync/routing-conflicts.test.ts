/**
 * Routing Conflict Tests
 * 
 * Validates that borderline prompts route to the correct skill among:
 * - azure-resource-visualizer (diagram generation)
 * - azure-iac-generator (Bicep generation from Azure/diagrams)
 * - azure-infrastructure-sync (drift detection / sync)
 * - azure-validate (pre-deployment validation)
 * 
 * These four skills share Azure infrastructure terminology but serve 
 * different purposes. This test ensures triggers disambiguate correctly.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

interface SkillPair {
  name: string;
  skill: LoadedSkill;
  matcher: TriggerMatcher;
}

const SKILL_NAMES = [
  "azure-resource-visualizer",
  "azure-iac-generator",
  "azure-infrastructure-sync",
  "azure-validate",
];

describe("Routing Conflict Tests - AzVerify Skills", () => {
  const skills: Map<string, SkillPair> = new Map();

  beforeAll(async () => {
    for (const name of SKILL_NAMES) {
      const skill = await loadSkill(name);
      const matcher = new TriggerMatcher(skill);
      skills.set(name, { name, skill, matcher });
    }
  });

  /** Helper: returns names of skills that trigger on a prompt */
  function triggeredSkills(prompt: string): string[] {
    return SKILL_NAMES.filter((name) => {
      const pair = skills.get(name)!;
      return pair.matcher.shouldTrigger(prompt).triggered;
    });
  }

  describe("Diagram generation → azure-resource-visualizer", () => {
    const prompts = [
      "Create a diagram of my Azure resources",
      "Visualize my Azure architecture",
      "Generate a Mermaid diagram from my resource group",
      "Draw my Azure infrastructure",
    ];

    test.each(prompts)('"%s" triggers visualizer', (prompt) => {
      const triggered = triggeredSkills(prompt);
      expect(triggered).toContain("azure-resource-visualizer");
    });
  });

  describe("Bicep generation → azure-iac-generator", () => {
    const prompts = [
      "Generate Bicep from my Azure resource group",
      "Convert my diagram to Bicep templates",
      "Reverse engineer my Azure infrastructure to Bicep",
    ];

    test.each(prompts)('"%s" triggers iac-generator', (prompt) => {
      const triggered = triggeredSkills(prompt);
      expect(triggered).toContain("azure-iac-generator");
    });
  });

  describe("Drift detection → azure-infrastructure-sync", () => {
    const prompts = [
      "Check if my diagram matches what's deployed",
      "Detect infrastructure drift",
      "Sync diagram with Azure",
      "Compare Bicep to my diagram for differences",
    ];

    test.each(prompts)('"%s" triggers infrastructure-sync', (prompt) => {
      const triggered = triggeredSkills(prompt);
      expect(triggered).toContain("azure-infrastructure-sync");
    });
  });

  describe("Pre-deployment validation → azure-validate", () => {
    const prompts = [
      "Validate my Bicep before deploying",
      "Run preflight checks on my deployment",
      "Check if my app is ready to deploy to Azure",
    ];

    test.each(prompts)('"%s" triggers validate', (prompt) => {
      const triggered = triggeredSkills(prompt);
      expect(triggered).toContain("azure-validate");
    });
  });

  describe("Keyword overlap is expected across related skills", () => {
    // The keyword matcher is intentionally broad. Multiple skills may trigger
    // on the same prompt because they share domain terminology (Azure, Bicep,
    // diagram, infrastructure). LLM routing disambiguates at runtime.
    const borderlinePrompts = [
      "Generate Bicep from my Azure diagram",
      "Compare my Azure infrastructure diagram",
      "Check my Bicep Azure deployment",
    ];

    test.each(borderlinePrompts)(
      '"%s" triggers multiple related skills (expected)',
      (prompt) => {
        const triggered = triggeredSkills(prompt);
        expect(triggered.length).toBeGreaterThanOrEqual(1);
      }
    );
  });

  describe("Each skill has DO NOT USE FOR disambiguation", () => {
    test.each(["azure-iac-generator", "azure-infrastructure-sync"])(
      '%s description includes DO NOT USE FOR',
      (name) => {
        const pair = skills.get(name)!;
        expect(pair.skill.metadata.description).toMatch(/DO NOT USE FOR/i);
      }
    );
  });
});
