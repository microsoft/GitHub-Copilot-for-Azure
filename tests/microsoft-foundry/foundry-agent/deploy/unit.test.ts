/**
 * Unit Tests for deploy
 *
 * Test isolated skill logic and validation rules.
 * Tests verify the deploy.md content including the
 * post-deployment auto-create evaluators & dataset flow.
 */

import * as fs from "fs";
import * as path from "path";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe("deploy - Unit Tests", () => {
  let skill: LoadedSkill;
  let deployContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    deployContent = fs.readFileSync(
      path.join(skill.path, "foundry-agent", "deploy", "deploy.md"),
      "utf-8"
    );
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
      expect(skill.metadata.description.length).toBeLessThan(2048);
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

  describe("Deploy Content Structure", () => {
    test("has substantive content", () => {
      expect(deployContent).toBeDefined();
      expect(deployContent.length).toBeGreaterThan(100);
    });

    test("contains Quick Reference section", () => {
      expect(deployContent).toContain("## Quick Reference");
      expect(deployContent).toContain("| MCP server | `azure` |");
    });

    test("contains When to Use section", () => {
      expect(deployContent).toContain("## When to Use This Skill");
    });

    test("documents MCP tools", () => {
      expect(deployContent).toContain("## MCP Tools");
      expect(deployContent).toContain("agent_definition_schema_get");
      expect(deployContent).toContain("agent_update");
      expect(deployContent).toContain("agent_get");
    });

    test("contains hosted agent workflow", () => {
      expect(deployContent).toContain("## Workflow: Hosted Agent Deployment");
    });

    test("documents the hosted deployment verification flow", () => {
      expect(deployContent).toMatch(/Capture the per-agent identity from the agent creation response/i);
      expect(deployContent).toMatch(/project-level agent identity from the project resource/i);
      expect(deployContent).toMatch(/Continue to Step 8/i);
      expect(deployContent).toMatch(/required hosted-agent session handling/i);
    });

    test("contains prompt agent workflow", () => {
      expect(deployContent).toContain("## Workflow: Prompt Agent Deployment");
    });

    test("contains error handling section", () => {
      expect(deployContent).toContain("## Error Handling");
    });

    test("lists invocations as a supported container protocol", () => {
      expect(deployContent).toContain("`invocations`");
      expect(deployContent).toMatch(/Invocation payload protocol/i);
    });
  });

  describe("After Deployment — Auto-Generate Evaluation Suite", () => {
    test("has auto-generate evaluation suite section", () => {
      expect(deployContent).toContain("Auto-Generate Evaluation Suite");
    });

    test("marks suite generation as automatic (not optional)", () => {
      expect(deployContent).toMatch(/automatic|immediately/i);
    });

    test("instructs reading agent instructions via agent_get", () => {
      expect(deployContent).toContain("agent_get");
    });

    test("uses evaluation suite generation as the preferred setup path", () => {
      expect(deployContent).toContain("evaluation_suite_generation_job_create");
      expect(deployContent).toContain("evaluation_suite_generation_job_get");
      expect(deployContent).toContain("evaluation_suite_get");
      expect(deployContent).toContain("generationModelDeploymentName");
      expect(deployContent).toContain("dataGenerationType");
      expect(deployContent).toContain("maxSamples");
      expect(deployContent).toContain("traceAgentName");
      expect(deployContent).toContain("traceStartTime");
    });

    test("documents manual fallback to evaluator and dataset suggestions", () => {
      expect(deployContent).toContain("evaluator_catalog_get");
      expect(deployContent).toContain("Generate Seed Evaluation Dataset");
      expect(deployContent).toContain("evaluation_dataset_create");
      expect(deployContent).toContain("generationSource: manual-fallback");
      expect(deployContent).toContain("expected_behavior");
      expect(deployContent).toMatch(/fallback reason/i);
    });

    test("instructs identifying judge deployment from actual project deployments", () => {
      expect(deployContent).toContain("model_deployment_get");
      expect(deployContent).toMatch(/actual model deployments/i);
      expect(deployContent).toMatch(/supports chat completions/i);
      expect(deployContent).toMatch(/do\s+\*\*not\*\*\s+assume\s+`gpt-4o`\s+exists/i);
    });

    test("instructs persisting generated artifacts to .foundry/evaluators/ and .foundry/datasets/", () => {
      expect(deployContent).toContain(".foundry/evaluators/");
      expect(deployContent).toContain(".foundry/datasets/");
      expect(deployContent).toContain("datasetUri");
      expect(deployContent).toContain("suiteName");
      expect(deployContent).toContain("suiteVersion");
      expect(deployContent).toContain("generationJobId");
      expect(deployContent).toContain("generationSource");
      expect(deployContent).toMatch(/filename must start with the selected environment's Foundry agent name/i);
    });

    test("scopes deploy scanning and cache usage to the selected agent root", () => {
      expect(deployContent).toMatch(/selected agent root/i);
      expect(deployContent).toMatch(/Do \*\*not\*\* scan sibling agent folders/i);
    });

    test("uses the seed dataset guide as the manual fallback flow", () => {
      expect(deployContent).toContain("Generate Seed Evaluation Dataset");
      expect(deployContent).toContain("evaluation_dataset_create");
      expect(deployContent).not.toContain("--account-key <storage-account-key>");
      expect(deployContent).not.toContain("--auth-mode login");
    });

    test("surfaces generation failures instead of silently falling back", () => {
      expect(deployContent).toMatch(/Do \*\*not\*\* silently ignore generation failures/i);
      expect(deployContent).toMatch(/generated-suite path or the fallback path/i);
    });

    test("asks to RUN evaluation (not just set up)", () => {
      expect(deployContent).toMatch(
        /run an evaluation to identify optimization opportunities/i
      );
    });

    test("directs to observe skill Step 2 for evaluation", () => {
      expect(deployContent).toContain("observe skill");
      expect(deployContent).toMatch(/Step 2.*Evaluate/i);
    });

    test("documents required invocation RBAC for hosted agents", () => {
      expect(deployContent).toContain("Azure AI User");
      expect(deployContent).not.toContain("Cognitive Services OpenAI User");
      expect(deployContent).toMatch(/per-agent identity.*agent creation response/i);
      expect(deployContent).toMatch(/project-level agent identity.*project resource/i);
      expect(deployContent).not.toContain("Required identities:");
      expect(deployContent).toMatch(/Cognitive Services account, not the project/i);
    });
  });

  describe("Document Deployment Context", () => {
    test("persists deployment context to the selected metadata file", () => {
      expect(deployContent).toContain("projectEndpoint");
      expect(deployContent).toContain("agentName");
      expect(deployContent).toContain("azureContainerRegistry");
      expect(deployContent).toContain("evaluationSuites[]");
      expect(deployContent).toContain("datasetUri");
      expect(deployContent).toContain("tags");
      expect(deployContent).toContain("tier: smoke");
      expect(deployContent).toContain("selected metadata file");
      expect(deployContent).toContain("agent-metadata.prod.yaml");
      expect(deployContent).toContain("single-environment file");
      expect(deployContent).toContain("older `testSuites[]`");
      expect(deployContent).toContain("legacy `testCases[]`");
      expect(deployContent).toContain("rewrite that environment to `evaluationSuites[]`");
    });
  });
});
