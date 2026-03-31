/**
 * Unit Tests for azure-enterprise-infra-planner
 * 
 * Test isolated skill logic, validation rules, and reference data integrity.
 */

import * as fs from "fs";
import * as path from "path";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-enterprise-infra-planner";

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description meets Medium-High compliance length", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
    });

    test("description contains WHEN trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("when:");
    });

    test("description contains PREFER routing guidance", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("prefer");
    });
  });

  describe("Skill Content", () => {
    let workflowContent: string;

    beforeAll(() => {
      const workflowPath = path.join(skill.path, "references", "workflow.md");
      workflowContent = fs.readFileSync(workflowPath, "utf-8");
    });

    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("documents research phase", () => {
      expect(skill.content).toContain("Research");
      expect(skill.content).toContain("microsoft_docs_search");
      expect(skill.content).toContain("microsoft_docs_fetch");
    });

    test("documents plan generation phase", () => {
      expect(skill.content).toContain("Plan Generation");
      expect(workflowContent).toContain("infrastructure-plan.json");
    });

    test("documents IaC generation phase", () => {
      expect(skill.content).toContain("IaC Generation");
      expect(skill.content).toContain("Bicep");
      expect(skill.content.toLowerCase()).toContain("terraform");
    });

    test("documents deployment phase", () => {
      expect(skill.content).toContain("Deployment");
      expect(skill.content).toContain("az deployment group create");
      expect(skill.content).toContain("terraform apply");
    });

    test("documents status lifecycle", () => {
      expect(workflowContent).toContain("Status Lifecycle");
      expect(workflowContent).toContain("draft");
      expect(workflowContent).toContain("approved");
      expect(workflowContent).toContain("deployed");
    });

    test("documents plan-first workflow gate", () => {
      expect(workflowContent).toContain("wait for approval");
    });

    test("lists all required MCP tools", () => {
      const requiredTools = [
        "microsoft_docs_search",
        "microsoft_docs_fetch",
      ];
      for (const tool of requiredTools) {
        expect(skill.content).toContain(tool);
      }
    });
  });

  describe("Plan-First Workflow", () => {
    let workflowContent: string;

    beforeAll(() => {
      const workflowPath = path.join(skill.path, "references", "workflow.md");
      workflowContent = fs.readFileSync(workflowPath, "utf-8");
    });

    test("requires user confirmation before deployment", () => {
      expect(skill.content.toLowerCase()).toContain("approved");
    });

    test("has blocking plan requirement", () => {
      expect(skill.content).toContain("approved");
    });

    test("references plan schema", () => {
      expect(skill.content).toContain("plan-schema.md");
    });

    test("references verification workflow", () => {
      expect(workflowContent).toContain("verification.md");
    });
  });

  describe("Reference Data Integrity", () => {
    let referencesDir: string;

    const categoryFiles = [
      "README.md",
      "ai-ml.md",
      "compute-apps.md",
      "compute-infra.md",
      "data-analytics.md",
      "data-relational.md",
      "messaging.md",
      "monitoring.md",
      "networking-connectivity.md",
      "networking-core.md",
      "networking-traffic.md",
      "security.md",
    ];

    beforeAll(() => {
      referencesDir = path.join(skill.path, "references");
    });

    test("references directory exists", () => {
      expect(fs.existsSync(referencesDir)).toBe(true);
    });

    test("required reference files exist", () => {
      const requiredFiles = [
        "plan-schema.md",
        "verification.md",
        "research.md",
        "deployment.md",
        "waf-checklist.md",
        "pairing-checks.md",
        "bicep-generation.md",
        "terraform-generation.md",
      ];
      for (const file of requiredFiles) {
        expect(fs.existsSync(path.join(referencesDir, file))).toBe(true);
      }
    });

    test("constraints/ directory exists with all category files", () => {
      const constraintsDir = path.join(referencesDir, "constraints");
      expect(fs.existsSync(constraintsDir)).toBe(true);
      for (const file of categoryFiles) {
        expect(fs.existsSync(path.join(constraintsDir, file))).toBe(true);
      }
    });

    test("resources/ directory exists with all category files", () => {
      const resourcesDir = path.join(referencesDir, "resources");
      expect(fs.existsSync(resourcesDir)).toBe(true);
      for (const file of categoryFiles) {
        expect(fs.existsSync(path.join(resourcesDir, file))).toBe(true);
      }
    });

    test("resources category files contain ARM type references", () => {
      const content = fs.readFileSync(
        path.join(referencesDir, "resources", "compute-infra.md"), "utf-8"
      );
      expect(content).toContain("Microsoft.");
    });

    test("constraints category files have pairing rules", () => {
      const content = fs.readFileSync(
        path.join(referencesDir, "constraints", "networking-core.md"), "utf-8"
      );
      expect(content.split("\n").length).toBeGreaterThan(10);
    });

    test("plan-schema.md documents the infrastructure plan format", () => {
      const content = fs.readFileSync(
        path.join(referencesDir, "plan-schema.md"), "utf-8"
      );
      expect(content).toContain("meta");
      expect(content).toContain("resources");
      expect(content).toContain("reasoning");
    });

  });
});
