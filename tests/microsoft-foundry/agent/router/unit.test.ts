/**
 * Unit Tests for foundry-agent-router (microsoft-foundry/agent)
 *
 * Test the router skill metadata and common content.
 */

import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/agent";

describe(`agent router - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("agent");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description is appropriately sized", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR triggers", () => {
      expect(skill.metadata.description).toMatch(/USE FOR:/i);
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      expect(skill.metadata.description).toMatch(/DO NOT USE FOR:/i);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains routing table", () => {
      expect(skill.content).toContain("## Skill Routing");
      expect(skill.content).toContain("package");
      expect(skill.content).toContain("deploy");
      expect(skill.content).toContain("invoke");
      expect(skill.content).toContain("troubleshoot");
    });

    test("contains common project context resolution", () => {
      expect(skill.content).toContain("## Common: Project Context Resolution");
      expect(skill.content).toContain("azure.yaml");
      expect(skill.content).toContain("azd env get-values");
    });

    test("documents azd variable mapping", () => {
      expect(skill.content).toContain("AZURE_AI_PROJECT_ENDPOINT");
      expect(skill.content).toContain("AZURE_CONTAINER_REGISTRY_NAME");
    });

    test("contains common tool usage conventions", () => {
      expect(skill.content).toContain("ask_user");
      expect(skill.content).toContain("askQuestions");
      expect(skill.content).toContain("runSubagent");
    });

    test("contains common MCP server reference", () => {
      expect(skill.content).toContain("## Common: MCP Server");
      expect(skill.content).toContain("agent_get");
      expect(skill.content).toContain("agent_update");
      expect(skill.content).toContain("agent_invoke");
    });
  });
});
