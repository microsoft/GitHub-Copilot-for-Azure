/**
 * Unit Tests for azure-validate
 * 
 * Tests for deployment readiness validation skill.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-validate";

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

    test("description mentions validation or deployment readiness", () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/validate|validation|ready|deployment|preflight/);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(200);
    });

    test("contains triggers section", () => {
      expect(skill.content).toMatch(/trigger/i);
    });

    test("documents the workflow steps", () => {
      expect(skill.content).toMatch(/step/i);
    });

    test("references azure-prepare prerequisite", () => {
      expect(skill.content).toMatch(/azure-prepare/i);
    });

    test("references azure-deploy as next step", () => {
      expect(skill.content).toMatch(/azure-deploy/i);
    });

    test("mentions plan file", () => {
      expect(skill.content).toMatch(/plan\.md/i);
    });
  });

  describe("Static Role Verification Step", () => {
    test("includes static role verification step in workflow", () => {
      expect(skill.content).toContain("Static Role Verification");
    });

    test("references role-verification.md", () => {
      expect(skill.content).toContain("role-verification.md");
    });

    test("mentions RBAC role assignments", () => {
      expect(skill.content).toMatch(/rbac|role\s+assignment/i);
    });

    test("role verification comes before record proof", () => {
      const roleVerifIndex = skill.content.indexOf("Static Role Verification");
      const recordProofIndex = skill.content.indexOf("Record Proof");
      expect(roleVerifIndex).toBeGreaterThan(-1);
      expect(recordProofIndex).toBeGreaterThan(-1);
      expect(roleVerifIndex).toBeLessThan(recordProofIndex);
    });
  });

  describe("Policy Compliance Step", () => {
    test("includes policy compliance check step", () => {
      expect(skill.content).toContain("Policy Compliance Check");
    });

    test("references bicep-policy-check-workflow.md", () => {
      expect(skill.content).toContain("bicep-policy-check-workflow.md");
    });

    test("policy check comes after role verification and before record proof", () => {
      const roleVerifIndex = skill.content.indexOf("Static Role Verification");
      const policyIndex = skill.content.indexOf("Policy Compliance Check");
      const recordProofIndex = skill.content.indexOf("Record Proof");
      expect(policyIndex).toBeGreaterThan(roleVerifIndex);
      expect(policyIndex).toBeLessThan(recordProofIndex);
    });

    test("marks policy check as optional", () => {
      expect(skill.content).toMatch(/optional/i);
    });
  });

  describe("Workflow Integration", () => {
    test("documents recipe references", () => {
      expect(skill.content).toMatch(/recipe/i);
    });

    test("mentions validation status requirement", () => {
      expect(skill.content).toMatch(/validated/i);
    });
  });
});
