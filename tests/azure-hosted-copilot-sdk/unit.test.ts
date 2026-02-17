/**
 * Unit Tests for azure-hosted-copilot-sdk
 * 
 * Test skill metadata, content, and frontmatter formatting.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-hosted-copilot-sdk";

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

    test("description is concise and actionable", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(1025);
    });

    test("description contains USE FOR trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("USE FOR:");
      expect(description).toContain("DO NOT USE FOR:");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("references SDK templates", () => {
      expect(skill.content).toContain("copilot-sdk-agent");
    });

    test("references deploy workflow", () => {
      expect(skill.content).toContain("azure-prepare");
      expect(skill.content).toContain("azure-deploy");
    });

    test("references SDK documentation", () => {
      expect(skill.content).toContain("SDK ref");
    });

    test("includes deploy-existing path", () => {
      expect(skill.content).toContain("deploy ref");
      expect(skill.content).toContain("deploy-existing");
    });
  });

  describe("BYOM Content", () => {
    test("includes BYOM routing step", () => {
      expect(skill.content).toContain("Step 2C");
      expect(skill.content).toContain("BYOM");
    });

    test("links to azure-model-config reference", () => {
      expect(skill.content).toContain("azure-model-config.md");
    });

    test("mentions DefaultAzureCredential for BYOM", () => {
      expect(skill.content).toContain("DefaultAzureCredential");
    });

    test("description includes BYOM trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("BYOM");
      expect(description).toContain("azure model");
      expect(description).toContain("bring your own model");
    });

    test("azure-model-config.md reference file exists", () => {
      const refPath = skill.filePath.replace("SKILL.md", "references/azure-model-config.md");
      const content = readFileSync(refPath, "utf-8");
      expect(content).toContain("DefaultAzureCredential");
      expect(content).toContain("bearerToken");
      expect(content).toContain("AZURE_AI_FOUNDRY_PROJECT_ENDPOINT");
    });

    test("BYOM routing row in step 1 table", () => {
      expect(skill.content).toContain("Use Azure/own model");
      expect(skill.content).toContain("Step 2C");
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

    test("USE FOR and DO NOT USE FOR are inside description value, not separate keys", () => {
      const description = skill.metadata.description;
      if (description.includes("USE FOR")) {
        expect(description).toContain("USE FOR:");
      }
      if (description.includes("DO NOT USE FOR")) {
        expect(description).toContain("DO NOT USE FOR:");
      }
    });
  });
});
