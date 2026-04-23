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
      expect(deployContent).toContain("agent_update");
      expect(deployContent).toContain("agent_container_control");
      expect(deployContent).toContain("agent_container_status_get");
    });

    test("contains hosted agent workflow", () => {
      expect(deployContent).toContain("## Workflow: Hosted Agent Deployment");
    });

    test("documents vNext as the default hosted deployment path", () => {
      expect(deployContent).toMatch(/Use the vNext deployment flow by default/i);
      expect(deployContent).toMatch(/skip Step 7 and Step 8/i);
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

  describe("After Deployment — Auto-Create Evaluators", () => {
    test("has auto-create evaluators section", () => {
      expect(deployContent).toContain("Auto-Create Evaluators & Dataset");
    });

    test("marks auto-create as automatic (not optional)", () => {
      expect(deployContent).toMatch(/automatic|immediately/i);
    });

    test("instructs reading agent instructions via agent_get", () => {
      expect(deployContent).toContain("agent_get");
    });

    test("specifies default evaluator categories", () => {
      expect(deployContent).toContain("evaluator_catalog_get");
      expect(deployContent).toMatch(/custom.*built-in|built-in.*custom/i);
      expect(deployContent).toMatch(/name, category, and version/i);
      expect(deployContent).toMatch(/<=5/i);
      expect(deployContent).toContain("Quality");
      expect(deployContent).toContain("Safety");
      expect(deployContent).toContain("relevance");
      expect(deployContent).toContain("intent_resolution");
      expect(deployContent).toContain("task_adherence");
      expect(deployContent).toContain("indirect_attack");
      expect(deployContent).toContain("tool_call_accuracy");
    });

    test("uses the observe skill's two-phase evaluator strategy", () => {
      expect(deployContent).toContain("Two-Phase Evaluator Strategy");
      expect(deployContent).toMatch(/Phase 1 is built-in only/i);
      expect(deployContent).toContain("expected_behavior");
      expect(deployContent).toMatch(/behavioral scoring/i);
    });

    test("instructs identifying judge deployment from actual project deployments", () => {
      expect(deployContent).toContain("model_deployment_get");
      expect(deployContent).toMatch(/actual model deployments/i);
      expect(deployContent).toMatch(/supports chat completions/i);
      expect(deployContent).toMatch(/do\s+\*\*not\*\*\s+assume\s+`gpt-4o`\s+exists/i);
    });

    test("instructs persisting artifacts to .foundry/evaluators/ and .foundry/datasets/", () => {
      expect(deployContent).toContain(".foundry/evaluators/");
      expect(deployContent).toContain(".foundry/datasets/");
      expect(deployContent).toContain("datasetUri");
      expect(deployContent).toMatch(/filename must start with the selected environment's Foundry agent name/i);
    });

    test("uses the seed dataset guide as the canonical registration flow", () => {
      expect(deployContent).toContain("Generate Seed Evaluation Dataset");
      expect(deployContent).toMatch(/single source of truth for seed dataset registration/i);
      expect(deployContent).toContain("project_connection_list");
      expect(deployContent).toContain("AzureStorageAccount");
      expect(deployContent).toContain("evaluation_dataset_create");
      expect(deployContent).toContain("connectionName");
      expect(deployContent).toContain("<agent-name>-eval-seed");
      expect(deployContent).toContain("datasetUri");
      expect(deployContent).not.toContain("--account-key <storage-account-key>");
      expect(deployContent).not.toContain("--auth-mode login");
    });

    test("describes seed generation rules without a separate validation pass", () => {
      expect(deployContent).toMatch(/keep rows valid by construction/i);
      expect(deployContent).not.toContain(
        "Validation gates (JSON parsing, required fields, category coverage, minimum row count)"
      );
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

    test("documents required invocation RBAC for vNext hosted agents", () => {
      expect(deployContent).toContain("Cognitive Services User");
      expect(deployContent).toContain("principal_id");
      expect(deployContent).toMatch(/instance identity/i);
    });
  });

  describe("Document Deployment Context", () => {
    test("persists deployment context to agent-metadata.yaml", () => {
      expect(deployContent).toContain("projectEndpoint");
      expect(deployContent).toContain("agentName");
      expect(deployContent).toContain("azureContainerRegistry");
      expect(deployContent).toContain("testCases[]");
      expect(deployContent).toContain("datasetUri");
    });
  });
});
