/**
 * Unit Tests for azure-prepare
 * 
 * Test isolated skill logic and validation rules.
 */

import * as fs from "fs";
import * as path from "path";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-prepare";

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
      // Descriptions should be 150-2048 chars for Medium-High compliance
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThanOrEqual(2048);
    });

    test("description contains WHEN trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("when:");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(skill.content).toContain("## Triggers");
      expect(skill.content).toContain("## Rules");
      expect(skill.content).toContain("## Phase 1: Planning");
      expect(skill.content).toContain("## Phase 2: Execution");
      expect(skill.content).toContain("## Outputs");
    });

    test("references azure-validate for next steps", () => {
      expect(skill.content).toContain("azure-validate");
    });
  });

  describe("Plan-First Workflow", () => {
    test("mentions plan file requirement", () => {
      expect(skill.content).toContain(".azure/deployment-plan.md");
    });

    test("requires user confirmation for subscription and location", () => {
      expect(skill.content.toLowerCase()).toContain("subscription");
      expect(skill.content.toLowerCase()).toContain("location");
    });

    test("has blocking plan requirement", () => {
      expect(skill.content).toContain("PLAN-FIRST");
      expect(skill.content).toContain("BLOCKING");
    });
  });

  describe("Functional Verification Step", () => {
    test("includes functional verification step in workflow", () => {
      expect(skill.content).toContain("Functional Verification");
    });

    test("references functional-verification.md", () => {
      expect(skill.content).toContain("functional-verification.md");
    });

    test("functional verification comes before plan update", () => {
      const funcVerifIndex = skill.content.indexOf("Functional Verification");
      const updatePlanIndex = skill.content.indexOf("Update Plan");
      expect(funcVerifIndex).toBeGreaterThan(-1);
      expect(updatePlanIndex).toBeGreaterThan(-1);
      expect(funcVerifIndex).toBeLessThan(updatePlanIndex);
    });
  });

  describe("Subscription Policy Checks", () => {
    test("references policy tool in requirements", () => {
      const refsDir = path.join(
        SKILLS_PATH,
        "azure-prepare/references/requirements.md"
      );
      const content = fs.readFileSync(refsDir, "utf-8");
      expect(content).toContain("mcp_azure_mcp_policy");
    });

    test("mentions subscription policies in requirements", () => {
      const refsDir = path.join(
        SKILLS_PATH,
        "azure-prepare/references/requirements.md"
      );
      const content = fs.readFileSync(refsDir, "utf-8");
      expect(content).toContain("Subscription Policies");
      expect(content).toContain("policy_assignment_list");
    });
  });

  describe("Aspire Support", () => {
    test("aspire.md reference file exists", () => {
      const aspirePath = path.join(
        SKILLS_PATH,
        "azure-prepare/references/recipes/azd/aspire.md"
      );
      expect(fs.existsSync(aspirePath)).toBe(true);
    });

    test("aspire.md contains Docker context guidance", () => {
      const aspirePath = path.join(
        SKILLS_PATH,
        "azure-prepare/references/recipes/azd/aspire.md"
      );
      const aspireContent = fs.readFileSync(aspirePath, "utf-8");
      expect(aspireContent).toContain("AddDockerfile");
      expect(aspireContent).toContain("docker.context");
      expect(aspireContent).toContain("build context");
    });

    test("azure-yaml.md references aspire.md", () => {
      const azureYamlPath = path.join(
        SKILLS_PATH,
        "azure-prepare/references/recipes/azd/azure-yaml.md"
      );
      const azureYamlContent = fs.readFileSync(azureYamlPath, "utf-8");
      expect(azureYamlContent).toContain("aspire.md");
      expect(azureYamlContent).toContain("docker.context");
    });
  });
});
