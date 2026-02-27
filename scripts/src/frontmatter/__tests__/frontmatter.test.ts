/**
 * Tests for frontmatter spec validation
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  validateName,
  validateDescriptionFormat,
  validateNoXmlTags,
  validateNoReservedPrefix,
  validateSkillFile,
} from "../cli.js";
import { parseSkillContent } from "../../shared/parse-skill.js";

const TEST_DIR = resolve(__dirname, "__test_frontmatter__");

describe("Frontmatter Spec Validator", () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  // ── parseSkillContent (shared parser) ─────────────────────────────────────

  describe("parseSkillContent", () => {
    it("parses valid frontmatter into data, content, and raw", () => {
      const content = "---\nname: test\ndescription: \"Hello\"\n---\n\n# Body";
      const result = parseSkillContent(content);
      expect(result).not.toBeNull();
      expect(result!.data.name).toBe("test");
      expect(result!.data.description).toBe("Hello");
      expect(result!.content).toContain("# Body");
      expect(result!.raw).toContain("name: test");
    });

    it("returns null when no opening ---", () => {
      expect(parseSkillContent("# Just a markdown file")).toBeNull();
    });

    it("returns null when no closing ---", () => {
      expect(parseSkillContent("---\nname: test\n")).toBeNull();
    });

    it("normalises Windows line-endings", () => {
      const content = "---\r\nname: test\r\ndescription: \"Hello\"\r\n---\r\n\r\n# Body";
      const result = parseSkillContent(content);
      expect(result).not.toBeNull();
      expect(result!.data.name).toBe("test");
    });

    it("extracts raw YAML for format checks", () => {
      const content = "---\nname: test\ndescription: >-\n  Some text.\n---\n\n# Body";
      const result = parseSkillContent(content);
      expect(result).not.toBeNull();
      expect(result!.raw).toContain("description: >-");
    });

    it("handles single-quoted YAML values", () => {
      const content = "---\nname: 'my-skill'\ndescription: 'Hello world'\n---\n\n# Body";
      const result = parseSkillContent(content);
      expect(result).not.toBeNull();
      expect(result!.data.name).toBe("my-skill");
    });

    it("handles escaped quotes in double-quoted strings", () => {
      const content = "---\nname: test\ndescription: \"Say \\\"hello\\\"\"\n---\n\n# Body";
      const result = parseSkillContent(content);
      expect(result).not.toBeNull();
      expect(result!.data.description).toBe("Say \"hello\"");
    });
  });

  // ── validateName ─────────────────────────────────────────────────────────

  describe("validateName", () => {
    it("passes for a valid name matching directory", () => {
      expect(validateName("azure-deploy", "azure-deploy")).toEqual([]);
    });

    it("passes for a single-character name", () => {
      expect(validateName("a", "a")).toEqual([]);
    });

    it("passes for a name with digits", () => {
      expect(validateName("azure-ai-2", "azure-ai-2")).toEqual([]);
    });

    it("fails for null name", () => {
      const issues = validateName(null, "test");
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("name-format");
      expect(issues[0].message).toContain("Missing");
    });

    it("fails for empty name", () => {
      const issues = validateName("", "test");
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("Missing");
    });

    it("fails for uppercase characters", () => {
      const issues = validateName("Azure-Deploy", "Azure-Deploy");
      expect(issues.some((i) => i.message.includes("uppercase"))).toBe(true);
    });

    it("fails for underscores", () => {
      const issues = validateName("azure_deploy", "azure_deploy");
      expect(issues.some((i) => i.message.includes("invalid characters"))).toBe(true);
    });

    it("fails for consecutive hyphens", () => {
      const issues = validateName("azure--deploy", "azure--deploy");
      expect(issues.some((i) => i.message.includes("consecutive hyphens"))).toBe(true);
    });

    it("fails for leading hyphen", () => {
      const issues = validateName("-azure-deploy", "-azure-deploy");
      expect(issues.some((i) => i.message.includes("start or end with a hyphen"))).toBe(true);
    });

    it("fails for trailing hyphen", () => {
      const issues = validateName("azure-deploy-", "azure-deploy-");
      expect(issues.some((i) => i.message.includes("start or end with a hyphen"))).toBe(true);
    });

    it("fails for name exceeding 64 chars", () => {
      const longName = "a" + "-bcde".repeat(16); // 65 chars
      const issues = validateName(longName, longName);
      expect(issues.some((i) => i.message.includes("max 64"))).toBe(true);
    });

    it("fails when name does not match directory", () => {
      const issues = validateName("azure-deploy", "azure-deploy-v2");
      expect(issues.some((i) => i.message.includes("does not match parent directory"))).toBe(true);
    });
  });

  // ── validateDescriptionFormat ────────────────────────────────────────────

  describe("validateDescriptionFormat", () => {
    it("passes for inline double-quoted description", () => {
      const fm = "name: test\ndescription: \"Deploy apps to Azure.\"";
      expect(validateDescriptionFormat(fm)).toEqual([]);
    });

    it("passes for unquoted simple description", () => {
      const fm = "name: test\ndescription: Deploy apps to Azure";
      expect(validateDescriptionFormat(fm)).toEqual([]);
    });

    it("fails for >- folded scalar", () => {
      const fm = "name: test\ndescription: >-\n  Deploy apps to Azure.";
      const issues = validateDescriptionFormat(fm);
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("description-format");
      expect(issues[0].message).toContain(">-");
    });

    it("fails for > folded scalar (without strip)", () => {
      const fm = "name: test\ndescription: >\n  Deploy apps to Azure.";
      const issues = validateDescriptionFormat(fm);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain(">-");
    });

    it("fails for | literal block", () => {
      const fm = "name: test\ndescription: |\n  Deploy apps to Azure.";
      const issues = validateDescriptionFormat(fm);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("literal block");
    });

    it("fails for |- literal block with strip", () => {
      const fm = "name: test\ndescription: |-\n  Deploy apps to Azure.";
      const issues = validateDescriptionFormat(fm);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("literal block");
    });
  });

  // ── validateNoXmlTags ────────────────────────────────────────────────────

  describe("validateNoXmlTags", () => {
    it("passes for clean frontmatter", () => {
      const fm = "name: test\ndescription: \"Deploy apps to Azure.\"";
      expect(validateNoXmlTags(fm)).toEqual([]);
    });

    it("passes for descriptions with comparison text", () => {
      // The word "greater" or math comparisons shouldn't trigger
      const fm = "name: test\ndescription: \"Description must be 150 chars\"";
      expect(validateNoXmlTags(fm)).toEqual([]);
    });

    it("fails for opening HTML tag", () => {
      const fm = "name: test\ndescription: \"<script>alert(1)</script>\"";
      const issues = validateNoXmlTags(fm);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].check).toBe("no-xml-tags");
    });

    it("fails for self-closing XML tag", () => {
      const fm = "name: test\ndescription: \"<br/>\"";
      const issues = validateNoXmlTags(fm);
      expect(issues.length).toBeGreaterThan(0);
    });

    it("fails for XML-style instruction", () => {
      const fm = "name: test\ndescription: \"<!DOCTYPE html>\"";
      const issues = validateNoXmlTags(fm);
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  // ── validateNoReservedPrefix ─────────────────────────────────────────────

  describe("validateNoReservedPrefix", () => {
    it("passes for a normal name", () => {
      expect(validateNoReservedPrefix("azure-deploy")).toEqual([]);
    });

    it("passes for null name", () => {
      expect(validateNoReservedPrefix(null)).toEqual([]);
    });

    it("fails for claude- prefix", () => {
      const issues = validateNoReservedPrefix("claude-my-skill");
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("reserved-prefix");
      expect(issues[0].message).toContain("claude-");
    });

    it("fails for anthropic- prefix", () => {
      const issues = validateNoReservedPrefix("anthropic-helper");
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("anthropic-");
    });

    it("passes for name containing but not starting with reserved prefix", () => {
      expect(validateNoReservedPrefix("my-claude-skill")).toEqual([]);
    });
  });

  // ── validateSkillFile (integration) ──────────────────────────────────────

  describe("validateSkillFile", () => {
    it("passes for a valid SKILL.md", () => {
      const skillDir = resolve(TEST_DIR, "valid-skill");
      mkdirSync(skillDir, { recursive: true });

      writeFileSync(
        resolve(skillDir, "SKILL.md"),
        "---\nname: valid-skill\ndescription: \"Deploy apps to Azure. WHEN: deploy, host, publish.\"\n---\n\n# Valid Skill\n",
      );

      const result = validateSkillFile(resolve(skillDir, "SKILL.md"));
      expect(result.issues).toEqual([]);
      expect(result.skill).toBe("valid-skill");
    });

    it("reports missing frontmatter", () => {
      const skillDir = resolve(TEST_DIR, "no-frontmatter");
      mkdirSync(skillDir, { recursive: true });

      writeFileSync(resolve(skillDir, "SKILL.md"), "# No Frontmatter\n");

      const result = validateSkillFile(resolve(skillDir, "SKILL.md"));
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].check).toBe("frontmatter");
    });

    it("catches multiple issues at once", () => {
      const skillDir = resolve(TEST_DIR, "claude-bad");
      mkdirSync(skillDir, { recursive: true });

      writeFileSync(
        resolve(skillDir, "SKILL.md"),
        "---\nname: claude-bad\ndescription: \"<script>inject</script>\"\n---\n\n# Bad\n",
      );

      const result = validateSkillFile(resolve(skillDir, "SKILL.md"));
      // Should have: reserved prefix + XML tags
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
      expect(result.issues.some((i) => i.check === "reserved-prefix")).toBe(true);
      expect(result.issues.some((i) => i.check === "no-xml-tags")).toBe(true);
    });

    it("catches name/directory mismatch", () => {
      const skillDir = resolve(TEST_DIR, "wrong-dir");
      mkdirSync(skillDir, { recursive: true });

      writeFileSync(
        resolve(skillDir, "SKILL.md"),
        "---\nname: correct-name\ndescription: \"Some description.\"\n---\n\n# Skill\n",
      );

      const result = validateSkillFile(resolve(skillDir, "SKILL.md"));
      expect(result.issues.some((i) => i.message.includes("does not match parent directory"))).toBe(true);
    });

    it("catches >- description format", () => {
      const skillDir = resolve(TEST_DIR, "folded-desc");
      mkdirSync(skillDir, { recursive: true });

      writeFileSync(
        resolve(skillDir, "SKILL.md"),
        "---\nname: folded-desc\ndescription: >-\n  Deploy apps to Azure.\n---\n\n# Skill\n",
      );

      const result = validateSkillFile(resolve(skillDir, "SKILL.md"));
      expect(result.issues.some((i) => i.check === "description-format")).toBe(true);
    });

    it("reports missing description field", () => {
      const skillDir = resolve(TEST_DIR, "no-desc");
      mkdirSync(skillDir, { recursive: true });

      writeFileSync(
        resolve(skillDir, "SKILL.md"),
        "---\nname: no-desc\n---\n\n# No Description\n",
      );

      const result = validateSkillFile(resolve(skillDir, "SKILL.md"));
      expect(result.issues.some((i) => i.check === "missing-field" && i.message.includes("description"))).toBe(true);
    });
  });
});
