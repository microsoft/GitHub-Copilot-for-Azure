/**
 * Unit Tests for customize (customize-deployment)
 * 
 * Test isolated skill logic and validation rules.
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";
const NESTED_FILE = "models/deploy-model/customize/SKILL.md";

interface NestedSkillMetadata {
  name: string;
  description: string;
  [key: string]: unknown;
}

describe("customize (customize-deployment) - Unit Tests", () => {
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
      expect(nestedMetadata.name).toBe("customize");
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

    test("contains expected sections", () => {
      expect(nestedContent).toContain("## Quick Reference");
      expect(nestedContent).toContain("## Prerequisites");
    });

    test("documents customization options", () => {
      expect(nestedContent).toContain("SKU");
      expect(nestedContent).toContain("capacity");
      expect(nestedContent).toContain("RAI");
    });

    test("documents PTU deployment support", () => {
      expect(nestedContent).toContain("PTU");
      expect(nestedContent).toContain("ProvisionedManaged");
    });

    test("contains comparison with preset mode", () => {
      expect(nestedContent).toContain("## When to Use");
    });
  });
});
