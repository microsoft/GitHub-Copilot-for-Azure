/**
 * Unit Tests for invoke
 *
 * Test isolated skill logic and validation rules.
 */

import * as fs from "fs";
import * as path from "path";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe("invoke - Unit Tests", () => {
  let skill: LoadedSkill;
  let invokeContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    invokeContent = fs.readFileSync(
      path.join(skill.path, "foundry-agent", "invoke", "invoke.md"),
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

  describe("Invoke Reference Content", () => {
    test("has substantive content", () => {
      expect(invokeContent).toBeDefined();
      expect(invokeContent.length).toBeGreaterThan(100);
    });

    test("documents hosted session behavior", () => {
      expect(invokeContent).toContain("sessionId");
      expect(invokeContent).toContain("session_create");
      expect(invokeContent).toContain("^[A-Za-z0-9_-]{8,128}$");
    });

    test("does not reference removed Python fallback scripts", () => {
      expect(invokeContent).not.toContain("scripts/invoke_agent_response.py");
      expect(invokeContent).not.toContain("scripts/invoke_agent_invocation.py");
      expect(invokeContent).not.toContain("scripts/requirements.txt");
    });

    test("documents hosted agent readiness checks", () => {
      expect(invokeContent).toMatch(/hosted agents/i);
      expect(invokeContent).toMatch(/agent_get/i);
      expect(invokeContent).toMatch(/active/i);
      expect(invokeContent).not.toContain("Hosted Agent (ACA)");
      expect(invokeContent).not.toContain("Hosted Agent (vNext)");
    });

    test("documents required hosted-agent invocation RBAC", () => {
      expect(invokeContent).toMatch(/RBAC|permission/i);
      expect(invokeContent).toMatch(/troubleshoot/i);
    });
  });
});
