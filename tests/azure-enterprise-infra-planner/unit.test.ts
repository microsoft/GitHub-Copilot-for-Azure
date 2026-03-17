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
      expect(skill.content).toContain("infrastructure-plan.json");
    });

    test("documents IaC generation phase", () => {
      expect(skill.content).toContain("IaC Generation");
      expect(skill.content).toContain("Bicep");
      expect(skill.content).toContain("Terraform");
    });

    test("documents deployment phase", () => {
      expect(skill.content).toContain("Deployment");
      expect(skill.content).toContain("az deployment group create");
      expect(skill.content).toContain("terraform apply");
    });

    test("documents status lifecycle", () => {
      expect(skill.content).toContain("Status Lifecycle");
      expect(skill.content).toContain("draft");
      expect(skill.content).toContain("approved");
      expect(skill.content).toContain("deployed");
    });

    test("documents plan-first workflow gate", () => {
      expect(skill.content).toContain("MANDATORY WORKFLOW");
      expect(skill.content).toContain("wait for approval");
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
    test("requires user confirmation before deployment", () => {
      expect(skill.content.toLowerCase()).toContain("approved");
      expect(skill.content.toLowerCase()).toContain("subscription");
    });

    test("has blocking plan requirement", () => {
      expect(skill.content).toContain("approved");
    });

    test("references plan schema", () => {
      expect(skill.content).toContain("plan-schema.md");
    });

    test("references verification workflow", () => {
      expect(skill.content).toContain("verification.md");
    });
  });

  describe("Reference Data Integrity", () => {
    let referencesDir: string;

    beforeAll(() => {
      referencesDir = path.join(skill.path, "references");
    });

    test("references directory exists", () => {
      expect(fs.existsSync(referencesDir)).toBe(true);
    });

    test("required reference files exist", () => {
      const requiredFiles = [
        "resources.md",
        "plan-schema.md",
        "verification.md",
        "research.md",
        "deployment.md",
        "constraints.md",
        "waf-checklist.md",
        "pairing-checks.md",
        "bicep-generation.md",
        "terraform-generation.md",
        "error-handling.md",
      ];
      for (const file of requiredFiles) {
        expect(fs.existsSync(path.join(referencesDir, file))).toBe(true);
      }
    });

    test("resources.md contains ARM type references", () => {
      const content = fs.readFileSync(
        path.join(referencesDir, "resources.md"), "utf-8"
      );
      expect(content).toContain("Microsoft.");
    });

    test("constraints.md has pairing rules", () => {
      const content = fs.readFileSync(
        path.join(referencesDir, "constraints.md"), "utf-8"
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

    test("error-handling.md has remediation table", () => {
      const content = fs.readFileSync(
        path.join(referencesDir, "error-handling.md"), "utf-8"
      );
      expect(content).toContain("Remediation");
    });
  });
});
