/**
 * Unit Tests for deploy
 *
 * Test isolated skill logic and validation rules.
 * Tests verify the deploy.md content including the
 * post-deployment auto-create evaluators & dataset flow.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEPLOY_MD = path.resolve(
  __dirname,
  "../../../../plugin/skills/microsoft-foundry/foundry-agent/deploy/deploy.md"
);

describe("deploy - Unit Tests", () => {
  let skill: LoadedSkill;
  let deployContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    deployContent = fs.readFileSync(DEPLOY_MD, "utf-8");
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

    test("contains prompt agent workflow", () => {
      expect(deployContent).toContain("## Workflow: Prompt Agent Deployment");
    });

    test("contains error handling section", () => {
      expect(deployContent).toContain("## Error Handling");
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
      expect(deployContent).toContain("Quality");
      expect(deployContent).toContain("Safety");
      expect(deployContent).toContain("intent_resolution");
      expect(deployContent).toContain("task_adherence");
      expect(deployContent).toContain("coherence");
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
  });

  describe("Document Deployment Context", () => {
    test("persists deployment context to agent-metadata.yaml", () => {
      expect(deployContent).toContain("projectEndpoint");
      expect(deployContent).toContain("agentName");
      expect(deployContent).toContain("azureContainerRegistry");
      expect(deployContent).toContain("testCases[]");
    });
  });
});
