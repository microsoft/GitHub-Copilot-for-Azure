/**
 * Unit Tests for deploy-model (router)
 * 
 * Test isolated skill logic and validation rules.
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";
const NESTED_FILE = "models/deploy-model/SKILL.md";

interface NestedSkillMetadata {
  name: string;
  description: string;
  [key: string]: unknown;
}

describe("deploy-model (router) - Unit Tests", () => {
  let skill: LoadedSkill;
  let nestedMetadata: NestedSkillMetadata;
  let nestedContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    const nestedFilePath = path.join(skill.path, NESTED_FILE);
    const fileContent = fs.readFileSync(nestedFilePath, "utf-8");
    const { data: metadata, content } = matter(fileContent);

    nestedMetadata = {
      name: (metadata.name as string) || "",
      description: (metadata.description as string) || "",
      ...metadata
    };
    nestedContent = content.trim();
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(nestedMetadata).toBeDefined();
      expect(nestedMetadata.name).toBe("deploy-model");
      expect(nestedMetadata.description).toBeDefined();
      expect(nestedMetadata.description.length).toBeGreaterThan(10);
    });

    test("description is appropriately sized", () => {
      expect(nestedMetadata.description.length).toBeGreaterThan(150);
      expect(nestedMetadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR triggers", () => {
      expect(nestedMetadata.description).toMatch(/USE FOR:/i);
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      expect(nestedMetadata.description).toMatch(/DO NOT USE FOR:/i);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(nestedContent).toBeDefined();
      expect(nestedContent.length).toBeGreaterThan(100);
    });

    test("contains routing sections", () => {
      expect(nestedContent).toContain("## Quick Reference");
      expect(nestedContent).toContain("## Intent Detection");
      expect(nestedContent).toContain("### Routing Rules");
    });

    test("contains sub-skill references", () => {
      expect(nestedContent).toContain("preset/SKILL.md");
      expect(nestedContent).toContain("customize/SKILL.md");
      expect(nestedContent).toContain("capacity/SKILL.md");
    });

    test("documents all three deployment modes", () => {
      expect(nestedContent).toContain("Preset");
      expect(nestedContent).toContain("Customize");
      expect(nestedContent).toContain("Capacity");
    });

    test("contains project selection guidance", () => {
      expect(nestedContent).toContain("## Project Selection");
      expect(nestedContent).toContain("PROJECT_RESOURCE_ID");
    });

    test("contains multi-mode chaining documentation", () => {
      expect(nestedContent).toContain("### Multi-Mode Chaining");
    });
  });

  describe("Prerequisites", () => {
    test("lists Azure CLI requirement", () => {
      expect(nestedContent).toContain("Azure CLI");
    });

    test("lists subscription requirement", () => {
      expect(nestedContent).toContain("Azure subscription");
    });
  });
});
