/**
 * Unit Tests for observe
 *
 * Test isolated skill logic and validation rules.
 * Tests verify the observe.md content and reference files
 * for the eval-driven optimization loop.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OBSERVE_MD = path.resolve(
  __dirname,
  "../../../../plugin/skills/microsoft-foundry/foundry-agent/observe/observe.md"
);
const REFERENCES_PATH = path.resolve(
  __dirname,
  "../../../../plugin/skills/microsoft-foundry/foundry-agent/observe/references"
);

describe("observe - Unit Tests", () => {
  let skill: LoadedSkill;
  let observeContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    observeContent = fs.readFileSync(OBSERVE_MD, "utf-8");
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("microsoft-foundry");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description is appropriately sized", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR triggers", () => {
      const description = skill.metadata.description;
      expect(description).toMatch(/USE FOR:/i);
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description;
      expect(description).toMatch(/DO NOT USE FOR:/i);
    });
  });

  describe("Observe Content Structure", () => {
    test("has substantive content", () => {
      expect(observeContent).toBeDefined();
      expect(observeContent.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(observeContent).toContain("## Entry Points");
      expect(observeContent).toContain("## Before Starting");
      expect(observeContent).toContain("## Loop Overview");
      expect(observeContent).toContain("## Behavioral Rules");
    });

    test("contains Quick Reference table", () => {
      expect(observeContent).toContain("## Quick Reference");
      expect(observeContent).toContain("azure");
    });
  });

  describe("Loop Overview", () => {
    test("contains numbered loop steps", () => {
      expect(observeContent).toContain("Auto-setup evaluators");
      expect(observeContent).toContain("Evaluate");
      expect(observeContent).toContain("cluster failures");
      expect(observeContent).toContain("Optimize prompt");
      expect(observeContent).toContain("Deploy new version");
      expect(observeContent).toContain("Re-evaluate");
      expect(observeContent).toContain("Compare versions");
      expect(observeContent).toContain("CI/CD");
    });
  });

  describe("Entry Points — Post-Deploy Flow", () => {
    test("has entry point for post-deploy auto-setup", () => {
      expect(observeContent).toMatch(/Agent just deployed|Set up evaluation/i);
    });

    test("routes evaluate intent through auto-setup when cache is missing or stale", () => {
      expect(observeContent).toMatch(/cache is missing|stale|refresh|check.*evaluators/i);
    });

    test("warns to check for existing evaluators before evaluation", () => {
      expect(observeContent).toContain(".foundry/agent-metadata.yaml");
      expect(observeContent).toContain(".foundry/evaluators/");
      expect(observeContent).toContain(".foundry/datasets/");
      expect(observeContent).toMatch(/auto-setup|Auto-Setup/i);
    });
  });

  describe("Reference Files Exist", () => {
    const expectedFiles = [
      "deploy-and-setup.md",
      "evaluate-step.md",
      "analyze-results.md",
      "optimize-deploy.md",
      "compare-iterate.md",
      "cicd-monitoring.md",
    ];

    test.each(expectedFiles)("has reference file: %s", (file) => {
      const filePath = path.join(REFERENCES_PATH, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe("Deploy-and-Setup Reference", () => {
    let setupContent: string;

    beforeAll(() => {
      setupContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "deploy-and-setup.md"),
        "utf-8"
      );
    });

    test("has auto-create evaluators as primary content", () => {
      expect(setupContent).toContain("Auto-Create Evaluators & Dataset");
    });

    test("marks auto-create as automatic", () => {
      expect(setupContent).toMatch(/automatic|fully automatic/i);
    });

    test("includes evaluator selection with quality and safety categories", () => {
      expect(setupContent).toContain("evaluator_catalog_get");
      expect(setupContent).toMatch(/custom.*built-in|built-in.*custom/i);
      expect(setupContent).toMatch(/name, category, and version/i);
      expect(setupContent).toMatch(/<=5/i);
      expect(setupContent).toContain("Quality");
      expect(setupContent).toContain("Safety");
      expect(setupContent).toContain("relevance");
      expect(setupContent).toContain("intent_resolution");
      expect(setupContent).toContain("task_adherence");
      expect(setupContent).toContain("indirect_attack");
      expect(setupContent).toContain("tool_call_accuracy");
    });

    test("references the built-in-first two-phase evaluator strategy", () => {
      expect(setupContent).toContain("Two-Phase Evaluator Strategy");
      expect(setupContent).toMatch(/Phase 1 is built-in only/i);
      expect(setupContent).toMatch(/do not create a new custom evaluator during the initial setup pass/i);
      expect(setupContent).toContain("expected_behavior");
      expect(setupContent).toContain("behavioral rubric");
    });

    test("includes judge deployment step based on actual project deployments", () => {
      expect(setupContent).toContain("model_deployment_get");
      expect(setupContent).toMatch(/actual model deployments/i);
      expect(setupContent).toMatch(/supports chat completions/i);
      expect(setupContent).toMatch(/do\s+\*\*not\*\*\s+assume\s+`gpt-4o`\s+exists/i);
    });

    test("generates seed datasets directly instead of invoking the judge deployment", () => {
      expect(setupContent).toMatch(/Generate the seed rows directly/i);
      expect(setupContent).toMatch(/Do \*\*not\*\* call the identified chat-capable deployment/i);
    });

    test("includes artifact persistence structure", () => {
      expect(setupContent).toContain(".foundry/agent-metadata.yaml");
      expect(setupContent).toContain(".foundry/evaluators/");
      expect(setupContent).toContain(".foundry/datasets/");
      expect(setupContent).toContain("datasetUri");
      expect(setupContent).toContain(".yaml");
      expect(setupContent).toContain(".jsonl");
      expect(setupContent).toMatch(/filename must start with the selected environment's Foundry agent name/i);
    });

    test("uses the seed dataset guide as the canonical registration flow", () => {
      expect(setupContent).toContain("Generate Seed Evaluation Dataset");
      expect(setupContent).toMatch(/single source of truth for registration/i);
      expect(setupContent).toContain("project_connection_list");
      expect(setupContent).toContain("AzureStorageAccount");
      expect(setupContent).toContain("evaluation_dataset_create");
      expect(setupContent).toContain("connectionName");
      expect(setupContent).toContain("<agent-name>-eval-seed");
      expect(setupContent).toContain("datasetUri");
      expect(setupContent).not.toContain("--account-key <storage-account-key>");
      expect(setupContent).not.toContain("--auth-mode login");
    });

    test("prompts user to run evaluation after auto-setup", () => {
      expect(setupContent).toMatch(
        /run an evaluation to identify optimization opportunities/i
      );
    });

    test("redirects to deploy skill for deployment (not inline)", () => {
      expect(setupContent).toContain("deploy skill");
      expect(setupContent).toContain("deploy.md");
    });
  });

  describe("Behavioral Rules", () => {
    test("requires auto-poll in background", () => {
      expect(observeContent).toMatch(/auto-poll|background/i);
    });

    test("requires confirmation before changes", () => {
      expect(observeContent).toMatch(/confirm|sign-off/i);
    });

    test("requires prompting for next steps", () => {
      expect(observeContent).toMatch(/prompt.*next|next.*steps/i);
    });

    test("requires scripts in files not inline", () => {
      expect(observeContent).toContain("scripts/");
    });

    test("requires persisting eval artifacts", () => {
      expect(observeContent).toContain(".foundry/evaluators/");
      expect(observeContent).toContain(".foundry/datasets/");
      expect(observeContent).toContain(".foundry/results/");
      expect(observeContent).toContain("P0");
    });

    test("documents evalId versus evaluationId guardrail", () => {
      const evaluateContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "evaluate-step.md"),
        "utf-8"
      );
      const compareContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "compare-iterate.md"),
        "utf-8"
      );

      expect(evaluateContent).toContain("evaluationId");
      expect(evaluateContent).toContain("evalId");
      expect(evaluateContent).toContain("expected_behavior");
      expect(evaluateContent).toMatch(/evaluation_get.*does\s+\*\*not\*\*\s+accept\s+`evaluationId`/i);
      expect(compareContent).toMatch(/creation uses `evaluationId`.*`evaluation_get`.*`evalId`/i);
    });

    test("requires judge deployment lookup instead of assuming gpt-4o", () => {
      const evaluateContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "evaluate-step.md"),
        "utf-8"
      );

      expect(evaluateContent).toContain("model_deployment_get");
      expect(evaluateContent).toMatch(/supports chat completions/i);
      expect(evaluateContent).toMatch(/do\s+\*\*not\*\*\s+assume\s+`gpt-4o`\s+exists/i);
    });

    test("requires checking existing evaluators before creating new ones", () => {
      expect(observeContent).toContain("evaluator_catalog_get");
      expect(observeContent).toMatch(/existing evaluators before creating new ones/i);
      expect(observeContent).toMatch(/initial setup, re-evaluation, and optimization loops/i);
    });

    test("documents the two-phase evaluator strategy and expected_behavior usage", () => {
      expect(observeContent).toContain("## Two-Phase Evaluator Strategy");
      expect(observeContent).toMatch(/Phase 1 - Initial setup/i);
      expect(observeContent).toMatch(/Phase 2 - After analysis/i);
      expect(observeContent).toContain("expected_behavior");
      expect(observeContent).toContain("behavioral_adherence");
      expect(observeContent).toMatch(/per-query behavioral rubric/i);
    });

    test("documents LLM judge knowledge-cutoff mitigation for real-time data", () => {
      const analyzeContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "analyze-results.md"),
        "utf-8"
      );

      expect(observeContent).toMatch(/LLM judge knowledge cutoff/i);
      expect(observeContent).toMatch(/web search, Bing Grounding, live APIs/i);
      expect(observeContent).toMatch(/fabricated|beyond knowledge cutoff/i);
      expect(analyzeContent).toMatch(/LLM judge knowledge cutoff/i);
      expect(analyzeContent).toMatch(/cannot verify|beyond knowledge cutoff|no evidence/i);
      expect(analyzeContent).toContain("Behavioral Rule 13");
    });

    test("documents evaluator deletion parameter requirements", () => {
      expect(observeContent).toContain("evaluator_catalog_delete");
      expect(observeContent).toMatch(/`name` \(not `evaluatorName`\) and `version`/i);
      expect(observeContent).toMatch(/delete each version individually/i);
      expect(observeContent).toMatch(/Discover version numbers with `evaluator_catalog_get`/i);
    });

    test("documents eval group immutability for evaluators and thresholds", () => {
      const evaluateContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "evaluate-step.md"),
        "utf-8"
      );
      const compareContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "compare-iterate.md"),
        "utf-8"
      );

      expect(evaluateContent).toMatch(/new evaluation group/i);
      expect(evaluateContent).toMatch(/thresholds/i);
      expect(compareContent).toMatch(/reuse the same `evaluationId` only when `evaluatorNames` and thresholds are unchanged/i);
    });

    test("downloads detailed results through the Foundry OpenAI evals REST API", () => {
      const analyzeContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "analyze-results.md"),
        "utf-8"
      );

      expect(analyzeContent).toContain("/openai/evals/{eval_id}/runs/{run_id}/output_items");
      expect(analyzeContent).toContain("2025-11-15-preview");
      expect(analyzeContent).toContain("https://ai.azure.com/.default");
      expect(analyzeContent).toContain("has_more");
      expect(analyzeContent).toContain("last_id");
      expect(analyzeContent).toContain("datasource_item.query");
      expect(analyzeContent).toContain("sample.output_text");
      expect(analyzeContent).toContain("custom_score");
      expect(analyzeContent).toContain("extract_evaluator_result");
      expect(analyzeContent).not.toContain("AIProjectClient");
      expect(analyzeContent).not.toContain("get_openai_client()");
      expect(analyzeContent).not.toContain("openai_client.evals.runs.output_items.list");
    });
  });
});
