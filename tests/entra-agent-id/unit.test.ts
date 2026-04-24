/**
 * Unit Tests for entra-agent-id
 *
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "entra-agent-id";

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
      expect(skill.content).toContain("## Conceptual Model");
      expect(skill.content).toContain("## Core Workflow");
      expect(skill.content).toContain("## Runtime Authentication");
      expect(skill.content).toContain("## API Reference");
      expect(skill.content).toContain("## Troubleshooting");
    });

    test("references the typed Graph endpoints (not raw @odata.type)", () => {
      expect(skill.content).toContain("microsoft.graph.agentIdentityBlueprint");
      expect(skill.content).toContain("microsoft.graph.agentIdentityBlueprintPrincipal");
      expect(skill.content).toContain("microsoft.graph.agentIdentity");
    });

    test("references the fmi_path exchange and the SDK sidecar", () => {
      expect(skill.content).toContain("fmi_path");
      expect(skill.content).toContain("Microsoft Entra SDK for AgentID");
    });

    test("references runtime-token-exchange reference file", () => {
      expect(skill.content).toContain("references/runtime-token-exchange.md");
    });
  });
});
