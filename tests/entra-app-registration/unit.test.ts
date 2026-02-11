/**
 * Unit Tests for entra-app-registration
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "entra-app-registration";

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

    test("description is within recommended length", () => {
      // Descriptions should be 150-1024 chars
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("use for:");
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("do not use for:");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(skill.content).toContain("## Overview");
      expect(skill.content).toContain("## Core Workflow");
      expect(skill.content).toContain("## Common Patterns");
    });

    test("references MSAL documentation", () => {
      expect(skill.content).toContain("MSAL");
    });

    test("references OAuth flows", () => {
      expect(skill.content).toContain("OAuth");
    });
  });
});
