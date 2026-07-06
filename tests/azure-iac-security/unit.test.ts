/**
 * Unit Tests for azure-iac-security
 *
 * Validates the SKILL.md frontmatter metadata and core structure so accidental
 * edits to the frontmatter (name, description, trigger phrases) are caught
 * early. This complements the CI frontmatter validator
 * (scripts/src/frontmatter/cli.ts) and the description snapshot in
 * triggers.test.ts.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-iac-security";

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Metadata", () => {
    test("name matches the skill directory", () => {
      expect(skill.metadata.name).toBe(SKILL_NAME);
    });

    test("has a non-empty description", () => {
      expect(typeof skill.metadata.description).toBe("string");
      expect(skill.metadata.description.trim().length).toBeGreaterThan(0);
    });

    test("description stays within a reasonable single-line length", () => {
      // Kept concise for reliable routing; the frontmatter validator requires
      // an inline (non-folded) description, so it must not grow unbounded.
      expect(skill.metadata.description.length).toBeLessThanOrEqual(250);
    });

    test("description documents WHEN-to-use trigger phrases", () => {
      expect(skill.metadata.description).toContain("WHEN:");
    });

    test("declares a license", () => {
      expect(skill.metadata.license).toBeDefined();
      expect(String(skill.metadata.license).length).toBeGreaterThan(0);
    });

    test("declares an author", () => {
      const meta = skill.metadata.metadata as { author?: string } | undefined;
      expect(meta?.author).toBeDefined();
      expect(String(meta?.author).length).toBeGreaterThan(0);
    });
  });

  describe("Content", () => {
    test("body is non-empty", () => {
      expect(skill.content.trim().length).toBeGreaterThan(0);
    });

    test("covers the supported IaC formats", () => {
      const body = skill.content.toLowerCase();
      expect(body).toContain("arm");
      expect(body).toContain("bicep");
      expect(body).toContain("terraform");
    });

    test("references MCSB control mapping", () => {
      expect(skill.content).toContain("MCSB");
    });
  });
});
