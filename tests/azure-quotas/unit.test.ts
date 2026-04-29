/**
 * Unit Tests for azure-quotas
 *
 * Test isolated skill logic and validation rules.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-quotas";

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
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      const hasTriggerPhrases =
        description.includes("use for") ||
        description.includes("use when") ||
        description.includes("when:") ||
        description.includes("helps") ||
        description.includes("activate") ||
        description.includes("trigger");
      expect(hasTriggerPhrases).toBe(true);
    });

  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("mentions az quota CLI commands", () => {
      expect(skill.content).toContain("az quota");
    });

    test("mentions the quota extension requirement", () => {
      expect(skill.content).toContain("az extension add --name quota");
    });

    test("mentions az quota list command", () => {
      expect(skill.content).toContain("az quota list");
    });

    test("mentions az quota show command", () => {
      expect(skill.content).toContain("az quota show");
    });

    test("mentions az quota usage show command", () => {
      expect(skill.content).toContain("az quota usage show");
    });

    test("mentions az quota update command for requesting increases", () => {
      expect(skill.content).toContain("az quota update");
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
      const supported = [
        "name", "description", "compatibility", "license", "metadata",
        "argument-hint", "disable-model-invocation", "user-invokable"
      ];
      const keys = frontmatter.split("\n")
        .filter((l: string) => /^[a-z][\w-]*\s*:/.test(l))
        .map((l: string) => l.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });

    test("USE FOR and DO NOT USE FOR are inside description value, not separate keys", () => {
      // ⚠️  These conditionals are format-only checks – they verify correct
      //     punctuation when the clause exists, but pass silently when it is absent.
      //     If this skill gains routing competition with a broader skill (e.g.
      //     azure-prepare) in the future, convert these to mandatory existence
      //     checks like azure-hosted-copilot-sdk/unit.test.ts.
      const description = skill.metadata.description;
      if (description.includes("USE FOR")) {
        expect(description).toContain("USE FOR:");
      }
      if (description.includes("DO NOT USE FOR")) {
        expect(description).toContain("DO NOT USE FOR:");
      }
    });
  });

  describe("Core Workflows", () => {
    test("describes checking quota for a specific resource", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/check quota|verify quota|show quota/);
    });

    test("describes comparing quotas across regions", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/compare.*region|across.*region|multi.*region/);
    });

    test("describes requesting quota increases", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/request.*increase|quota.*increase|increase.*quota/);
    });

    test("describes listing all quotas for planning", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/list.*quota|quota.*list/);
    });
  });

  describe("Resource Name Mapping", () => {
    test("warns about no 1:1 mapping between ARM types and quota names", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/no 1:1 mapping|resource name mapping/);
    });

    test("describes discovery workflow for quota resource names", () => {
      expect(skill.content.toLowerCase()).toContain("localizedvalue");
    });
  });

  describe("Scope Format", () => {
    test("documents the required scope pattern", () => {
      expect(skill.content).toContain("/subscriptions/");
      expect(skill.content).toContain("/providers/");
      expect(skill.content).toContain("/locations/");
    });
  });

  describe("Troubleshooting", () => {
    test("mentions ExtensionNotFound error", () => {
      expect(skill.content).toContain("ExtensionNotFound");
    });

    test("mentions BadRequest for unsupported providers", () => {
      expect(skill.content).toContain("BadRequest");
    });

    test("mentions MissingRegistration error", () => {
      expect(skill.content).toContain("MissingRegistration");
    });

    test("mentions QuotaExceeded error", () => {
      expect(skill.content).toContain("QuotaExceeded");
    });

    test("lists known unsupported providers", () => {
      expect(skill.content).toContain("Microsoft.DocumentDB");
    });

    test("lists confirmed working providers", () => {
      const content = skill.content;
      expect(content).toContain("Microsoft.Compute");
      expect(content).toContain("Microsoft.Network");
      expect(content).toContain("Microsoft.App");
      expect(content).toContain("Microsoft.Storage");
    });
  });
});
