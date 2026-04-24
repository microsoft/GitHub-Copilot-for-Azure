/**
 * Unit Tests for azure-kubernetes-automatic-readiness
 *
 * Tests skill content and structure without requiring external services.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../../utils/skill-loader";

const SKILL_NAME = "azure-kubernetes-automatic-readiness";
const SKILL_PATH = "azure-kubernetes/azure-kubernetes-automatic-readiness";

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_PATH);
  });

  describe("Skill Metadata", () => {
    test("has required frontmatter fields", () => {
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(50);
    });

    test("description contains WHEN triggers", () => {
      expect(skill.metadata.description).toContain("WHEN:");
    });

    test("description mentions AKS Automatic", () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/aks automatic/);
    });

    test("description is within 1024 character limit", () => {
      expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
    });
  });

  describe("Required Section Structure", () => {
    test("contains the standard skill sections", () => {
      expect(skill.content).toContain("## Quick Reference");
      expect(skill.content).toContain("## When to Use This Skill");
      expect(skill.content).toContain("## MCP Tools");
      expect(skill.content).toContain("## Workflow");
      expect(skill.content).toContain("## Error Handling");
    });
  });

  describe("Routing Rules", () => {
    test("routes cluster creation to azure-kubernetes", () => {
      expect(skill.content).toMatch(/Route to `azure-kubernetes` instead/i);
    });

    test("routes live troubleshooting to azure-diagnostics", () => {
      expect(skill.content).toMatch(/Route to `azure-diagnostics` instead/i);
    });
  });

  describe("Assessment Workflow", () => {
    test("covers cluster-connected assessment via MCP", () => {
      expect(skill.content).toMatch(/mcp_azure_mcp_aks/i);
      expect(skill.content).toMatch(/discover/i);
    });

    test("covers offline manifest validation", () => {
      expect(skill.content).toMatch(/offline/i);
      expect(skill.content).toMatch(/constraint-spec/i);
    });

    test("defines MCP-to-offline fallback chain", () => {
      expect(skill.content).toMatch(/fallback/i);
      expect(skill.content).toMatch(/offline/i);
    });

    test("includes MCP setup guidance when tool is unavailable", () => {
      expect(skill.content).toMatch(/aka\.ms\/azure-mcp-setup/i);
    });
  });

  describe("Severity Classification", () => {
    test("documents incompatible severity", () => {
      expect(skill.content).toMatch(/incompatible/i);
    });

    test("documents requiresChanges severity", () => {
      expect(skill.content).toMatch(/requiresChanges/i);
    });

    test("documents autoFixed severity", () => {
      expect(skill.content).toMatch(/autoFixed/i);
    });
  });

  describe("Fix Guidance", () => {
    test("covers deterministic fixes", () => {
      expect(skill.content).toMatch(/deterministic/i);
    });

    test("covers LLM-reasoned fixes", () => {
      expect(skill.content).toMatch(/LLM/i);
    });

    test("requires user approval before applying fixes", () => {
      expect(skill.content).toMatch(/accept|approval|explicit/i);
    });
  });

  describe("Guardrails", () => {
    test("enforces read-only cluster assessment", () => {
      expect(skill.content).toMatch(/read-only/i);
    });

    test("prohibits exposing secrets", () => {
      expect(skill.content).toMatch(/secret/i);
    });
  });

  describe("Frontmatter Formatting", () => {
    test("frontmatter has no tabs", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const frontmatter = frontmatterMatch ? frontmatterMatch[1] : "";
      expect(frontmatter).not.toMatch(/\t/);
    });

    test("frontmatter keys are only supported attributes", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const frontmatter = frontmatterMatch ? frontmatterMatch[1] : "";
      const supported = ["name", "description", "compatibility", "license", "metadata",
        "argument-hint", "disable-model-invocation", "user-invokable"];
      const keys = frontmatter.split(/\r?\n/)
        .filter((l: string) => /^[a-z][\w-]*\s*:/.test(l))
        .map((l: string) => l.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });

    test("WHEN clause is inside description", () => {
      expect(skill.metadata.description).toContain("WHEN:");
    });
  });
});
