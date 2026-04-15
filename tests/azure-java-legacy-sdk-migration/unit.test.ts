/**
 * Unit Tests for azure-java-legacy-sdk-migration
 *
 * Test isolated skill logic and validation rules.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-java-legacy-sdk-migration";

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
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
    });

    test("description contains WHEN trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("when:");
    });

    test("description contains DO NOT USE FOR exclusions", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR:");
    });

    test("description excludes non-Java languages", () => {
      const description = skill.metadata.description;
      expect(description).toContain(".NET");
      expect(description).toContain("Python");
      expect(description).toContain("JavaScript");
      expect(description).toContain("Go");
    });

    test("description word count is within limit", () => {
      const words = skill.metadata.description.split(/\s+/).length;
      expect(words).toBeLessThanOrEqual(80);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("references legacy SDK namespace", () => {
      expect(skill.content).toContain("com.microsoft.azure");
    });

    test("references modern SDK namespace", () => {
      expect(skill.content).toContain("com.azure");
    });

    test("contains workflow section", () => {
      expect(skill.content).toContain("## Workflow");
    });

    test("contains constraints section", () => {
      expect(skill.content).toContain("## Constraints");
    });

    test("contains troubleshooting section", () => {
      expect(skill.content).toContain("## Troubleshooting");
    });
  });

  describe("Workflow Phases", () => {
    test("defines precheck phase", () => {
      expect(skill.content).toContain("Precheck");
    });

    test("defines plan phase", () => {
      expect(skill.content).toContain("Plan");
    });

    test("defines execute phase", () => {
      expect(skill.content).toContain("Execute");
    });

    test("defines validate phase", () => {
      expect(skill.content).toContain("Validate");
    });

    test("references plan.md artifact", () => {
      expect(skill.content).toContain("plan.md");
    });

    test("references progress.md artifact", () => {
      expect(skill.content).toContain("progress.md");
    });

    test("references summary.md artifact", () => {
      expect(skill.content).toContain("summary.md");
    });
  });

  describe("Reference Files", () => {
    test("references RULES.md", () => {
      expect(skill.content).toContain("RULES.md");
    });

    test("references INSTRUCTION.md", () => {
      expect(skill.content).toContain("INSTRUCTION.md");
    });

    test("references plan template", () => {
      expect(skill.content).toContain("PLAN_TEMPLATE.md");
    });

    test("references progress template", () => {
      expect(skill.content).toContain("PROGRESS_TEMPLATE.md");
    });

    test("references summary template", () => {
      expect(skill.content).toContain("SUMMARY_TEMPLATE.md");
    });
  });

  describe("Build Tool Support", () => {
    test("supports Maven projects", () => {
      const content = skill.content.toLowerCase();
      expect(content).toContain("maven");
    });

    test("supports Gradle projects", () => {
      const content = skill.content.toLowerCase();
      expect(content).toContain("gradle");
    });
  });

  describe("Safety and Quality", () => {
    test("enforces 100% test pass requirement", () => {
      expect(skill.content).toContain("100% test pass");
    });

    test("prohibits premature termination", () => {
      expect(skill.content).toContain("no premature termination");
    });

    test("requires incremental changes", () => {
      expect(skill.content).toContain("incremental");
    });
  });

  describe("Frontmatter Formatting", () => {
    test("frontmatter has no tabs", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      const frontmatter = raw.split("---")[1];
      expect(frontmatter).not.toMatch(/\t/);
    });

    test("frontmatter keys are only supported attributes", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      const frontmatter = raw.split("---")[1];
      const supported = ["name", "description", "compatibility", "license", "metadata",
        "argument-hint", "disable-model-invocation", "user-invokable"];
      const keys = frontmatter.split("\n")
        .filter((l: string) => /^[a-z][\w-]*\s*:/.test(l))
        .map((l: string) => l.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });
  });
});
