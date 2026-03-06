/**
 * Unit Tests for azure-compute-vm-troubleshooting-connectivity
 *
 * Test isolated skill logic and validation rules.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-compute-vm-troubleshooting-connectivity";

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

    test("description is comprehensive and actionable", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("USE FOR:");
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR:");
    });

    test("has VM connectivity trigger keywords", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("rdp");
      expect(description).toContain("ssh");
      expect(description).toContain("nsg");
      expect(description).toContain("vm");
    });

    test("references related skills in DO NOT USE FOR", () => {
      const description = skill.metadata.description;
      expect(description).toContain("azure-diagnostics");
      expect(description).toContain("azure-deploy");
      expect(description).toContain("azure-cost-optimization");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test("contains workflow phases", () => {
      expect(skill.content).toContain("Phase 1");
      expect(skill.content).toContain("Phase 2");
      expect(skill.content).toContain("Phase 3");
      expect(skill.content).toContain("Phase 4");
      expect(skill.content).toContain("Phase 5");
    });

    test("includes Quick Reference table", () => {
      expect(skill.content).toContain("Quick Reference");
    });

    test("includes MCP Tools section", () => {
      expect(skill.content).toContain("MCP Tools");
      expect(skill.content).toContain("fetch_webpage");
    });

    test("includes Triggers section with activation phrases", () => {
      expect(skill.content).toContain("Triggers");
      expect(skill.content).toContain("can't connect");
      expect(skill.content).toContain("RDP not working");
    });

    test("includes Error Handling table", () => {
      expect(skill.content).toContain("Error Handling");
      expect(skill.content).toContain("fetch_webpage");
      expect(skill.content).toContain("CLI command fails");
    });

    test("references cannot-connect-to-vm.md", () => {
      expect(skill.content).toContain("references/cannot-connect-to-vm.md");
    });

    test("includes escalation commands", () => {
      expect(skill.content).toContain("az vm restart");
      expect(skill.content).toContain("az vm redeploy");
    });

    test("covers RDP and SSH categories in intent routing", () => {
      expect(skill.content).toContain("Unable to RDP");
      expect(skill.content).toContain("Unable to SSH");
      expect(skill.content).toContain("Network / Firewall");
      expect(skill.content).toContain("Credential / Auth");
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
