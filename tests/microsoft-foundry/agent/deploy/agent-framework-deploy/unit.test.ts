/**
 * Unit Tests for agent-framework-deploy
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/agent/deploy/agent-framework-deploy";

describe("agent-framework-deploy - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("agent-framework-deploy");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description is appropriately sized", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains deployment workflow section", () => {
      expect(skill.content).toContain("Deployment Workflow");
    });

    test("contains prerequisites section", () => {
      expect(skill.content).toContain("Prerequisites");
    });

    test("documents Dockerfile generation", () => {
      expect(skill.content).toContain("Dockerfile");
    });

    test("documents ACR configuration", () => {
      expect(skill.content).toContain("ACR");
      expect(skill.content).toContain("az acr build");
    });

    test("documents agent version deployment", () => {
      expect(skill.content).toContain("Deploy Agent Version");
    });

    test("documents deployment validation", () => {
      expect(skill.content).toContain("Validate Deployment");
    });

    test("references agent-as-server pattern", () => {
      expect(skill.content).toContain("agent-as-server.md");
    });

    test("specifies API version", () => {
      expect(skill.content).toContain("api-version=2025-05-15-preview");
    });

    test("documents post-deployment steps", () => {
      expect(skill.content).toContain("Post-Deployment");
    });
  });
});
