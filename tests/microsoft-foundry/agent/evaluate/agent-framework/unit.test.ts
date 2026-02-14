/**
 * Unit Tests for agent-framework (evaluate)
 * 
 * Test isolated skill logic and validation rules.
 */

import * as fs from "fs";
import * as path from "path";
import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/agent/evaluate/agent-framework";

describe("agent-framework (evaluate) - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("agent-framework");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description is appropriately sized", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR triggers", () => {
      expect(skill.metadata.description).toMatch(/USE FOR:/i);
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      expect(skill.metadata.description).toMatch(/DO NOT USE FOR:/i);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(skill.content).toContain("## Quick Reference");
      expect(skill.content).toContain("## When to Use This Skill");
      expect(skill.content).toContain("## Evaluation Workflow");
    });

    test("contains references table pointing to reference files", () => {
      expect(skill.content).toContain("## References");
      expect(skill.content).toContain("references/code-example.md");
      expect(skill.content).toContain("references/built-in-evaluators.md");
      expect(skill.content).toContain("references/custom-evaluators.md");
    });

    test("contains built-in evaluators section referencing file", () => {
      expect(skill.content).toContain("## Built-in Evaluators");
      expect(skill.content).toContain("references/built-in-evaluators.md");
    });

    test("contains custom evaluators section referencing file", () => {
      expect(skill.content).toContain("## Custom Evaluators");
      expect(skill.content).toContain("references/custom-evaluators.md");
    });

    test("contains error handling section", () => {
      expect(skill.content).toContain("## Error Handling");
    });

    test("documents MCP tools", () => {
      expect(skill.content).toContain("foundry_models_list");
      expect(skill.content).toContain("foundry_models_deployments_list");
      expect(skill.content).toContain("foundry_resource_get");
    });

    test("specifies plugin version", () => {
      expect(skill.content).toContain("pytest-agent-evals");
      expect(skill.content).toContain("0.0.1b260210");
    });

    test("documents evaluation result schema", () => {
      expect(skill.content).toContain("inputs.query");
      expect(skill.content).toContain("outputs.response");
      expect(skill.content).toContain("test-results/evaluation_results_");
    });

    test("references microsoft-foundry skill for model selection", () => {
      expect(skill.content).toContain("microsoft-foundry");
    });

    test("documents judge model env vars", () => {
      expect(skill.content).toContain("AZURE_OPENAI_ENDPOINT");
      expect(skill.content).toContain("FOUNDRY_MODEL_DEPLOYMENT_NAME");
    });

    test("step 1 references built-in evaluators for metric suggestions", () => {
      const step1Match = skill.content.match(/### Step 1:[\s\S]*?### Step 2:/);
      expect(step1Match).toBeTruthy();
      const step1Content = step1Match![0];
      expect(step1Content).toContain("references/built-in-evaluators.md");
      expect(step1Content).toContain("built-in");
      expect(step1Content).toContain("custom");
      expect(step1Content).toContain("prompt-based");
      expect(step1Content).toContain("code-based");
    });
  });

  describe("Reference Files", () => {
    test("code-example.md exists and contains key content", () => {
      const refPath = path.join(skill.path, "references", "code-example.md");
      expect(fs.existsSync(refPath)).toBe(true);
      const content = fs.readFileSync(refPath, "utf-8");
      expect(content).toContain("AzureOpenAIModelConfig");
      expect(content).toContain("ChatAgentConfig");
      expect(content).toContain("BuiltInEvaluatorConfig");
      expect(content).toContain("@pytest.fixture");
      expect(content).toContain("@evals.dataset");
      expect(content).toContain("@evals.judge_model");
    });

    test("built-in-evaluators.md exists and contains evaluator catalog", () => {
      const refPath = path.join(skill.path, "references", "built-in-evaluators.md");
      expect(fs.existsSync(refPath)).toBe(true);
      const content = fs.readFileSync(refPath, "utf-8");
      expect(content).toContain("task_adherence");
      expect(content).toContain("intent_resolution");
      expect(content).toContain("tool_call_accuracy");
      expect(content).toContain("coherence");
      expect(content).toContain("relevance");
      expect(content).toContain("groundedness");
      expect(content).toContain("similarity");
    });

    test("custom-evaluators.md exists and contains evaluator patterns", () => {
      const refPath = path.join(skill.path, "references", "custom-evaluators.md");
      expect(fs.existsSync(refPath)).toBe(true);
      const content = fs.readFileSync(refPath, "utf-8");
      expect(content).toContain("CustomPromptEvaluatorConfig");
      expect(content).toContain("CustomCodeEvaluatorConfig");
    });
  });
});
