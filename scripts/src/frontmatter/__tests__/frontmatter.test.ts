/**
 * Tests for frontmatter spec validation
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  validateName,
  validateDescriptionFormat,
  validateDescriptionLength,
  validateNoXmlTags,
  validateNoReservedPrefix,
  validateLicense,
  validateMetadata,
  validateMetadataVersion,
  validateCompatibility,
  validateAllowedTools,
  extractTriggerPhrases,
  hasDoNotUseForClause,
  hasPreferOverClause,
  isDisambiguationClauseRemoved,
  validateTriggerOverlapDisambiguation,
  validateSkillFile,
} from "../cli.js";
import { parseSkillContent } from "../../shared/skill-helper.js";

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

  // ── validateDescriptionLength ────────────────────────────────────────────

  describe("validateDescriptionLength", () => {
    it("passes for a normal description", () => {
      expect(validateDescriptionLength("Deploy apps to Azure.")).toEqual([]);
    });

    it("passes for exactly 1024 chars", () => {
      const desc = "a".repeat(1024);
      expect(validateDescriptionLength(desc)).toEqual([]);
    });

    it("fails for description exceeding 1024 chars", () => {
      const desc = "a".repeat(1025);
      const issues = validateDescriptionLength(desc);
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("description-length");
      expect(issues[0].message).toContain("max 1024");
    });

    it("returns no issues for null description", () => {
      expect(validateDescriptionLength(null)).toEqual([]);
    });

    it("returns no issues for empty description", () => {
      expect(validateDescriptionLength("")).toEqual([]);
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

  // ── validateLicense ─────────────────────────────────────────────────────

  describe("validateLicense", () => {
    it("passes for a valid license", () => {
      expect(validateLicense("MIT")).toEqual([]);
    });

    it("warns for missing license", () => {
      const issues = validateLicense(undefined);
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("license");
      expect(issues[0].severity).toBe("warning");
    });

    it("warns for null license", () => {
      const issues = validateLicense(null);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
    });

    it("warns for empty license", () => {
      const issues = validateLicense("");
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
    });

    it("fails for non-string license", () => {
      const issues = validateLicense(42);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("must be a string");
    });
  });

  // ── validateMetadata ────────────────────────────────────────────────────

  describe("validateMetadata", () => {
    it("passes for a valid string-valued map", () => {
      expect(validateMetadata({ author: "Microsoft", version: "1.0.0" })).toEqual([]);
    });

    it("warns when metadata is missing", () => {
      const issues = validateMetadata(undefined);
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("metadata");
      expect(issues[0].severity).toBe("warning");
    });

    it("warns when metadata is null", () => {
      const issues = validateMetadata(null);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
    });

    it("fails when metadata is a string", () => {
      const issues = validateMetadata("not-a-map");
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("metadata");
      expect(issues[0].message).toContain("key-value mapping");
    });

    it("fails when metadata is an array", () => {
      const issues = validateMetadata(["a", "b"]);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("array");
    });

    it("warns for non-string values in the map", () => {
      const issues = validateMetadata({ author: "Microsoft", count: 42 });
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("metadata");
      expect(issues[0].severity).toBe("warning");
      expect(issues[0].message).toContain("metadata.count");
    });

    it("warns for multiple non-string values", () => {
      const issues = validateMetadata({ author: "Microsoft", count: 42, active: true });
      expect(issues).toHaveLength(2);
    });

    it("passes for an empty map", () => {
      expect(validateMetadata({})).toEqual([]);
    });
  });

  // ── validateMetadataVersion ─────────────────────────────────────────────

  describe("validateMetadataVersion", () => {
    it("passes for valid semver", () => {
      expect(validateMetadataVersion({ version: "1.0.0" })).toEqual([]);
    });

    it("passes for higher semver", () => {
      expect(validateMetadataVersion({ version: "3.2.1" })).toEqual([]);
    });

    it("warns for missing metadata", () => {
      const issues = validateMetadataVersion(undefined);
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("metadata-version");
      expect(issues[0].severity).toBe("warning");
    });

    it("warns for missing version in metadata", () => {
      const issues = validateMetadataVersion({ author: "Microsoft" });
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("metadata-version");
      expect(issues[0].severity).toBe("warning");
    });

    it("fails for non-semver version", () => {
      const issues = validateMetadataVersion({ version: "1.0" });
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("not valid semver");
    });

    it("fails for non-numeric version", () => {
      const issues = validateMetadataVersion({ version: "latest" });
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("not valid semver");
    });

    it("fails for leading zeros", () => {
      const issues = validateMetadataVersion({ version: "01.0.0" });
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("not valid semver");
    });
  });

  // ── validateCompatibility ────────────────────────────────────────────────

  describe("validateCompatibility", () => {
    it("passes when not provided", () => {
      expect(validateCompatibility(undefined)).toEqual([]);
    });

    it("passes when null", () => {
      expect(validateCompatibility(null)).toEqual([]);
    });

    it("passes for a valid string within 500 chars", () => {
      expect(validateCompatibility("Requires git, docker, jq, and access to the internet")).toEqual([]);
    });

    it("passes for exactly 500 chars", () => {
      const compat = "a".repeat(500);
      expect(validateCompatibility(compat)).toEqual([]);
    });

    it("fails for non-string value", () => {
      const issues = validateCompatibility(42);
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("compatibility");
      expect(issues[0].message).toContain("must be a string");
    });

    it("fails for empty string", () => {
      const issues = validateCompatibility("");
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("must not be empty");
    });

    it("fails for string exceeding 500 chars", () => {
      const compat = "a".repeat(501);
      const issues = validateCompatibility(compat);
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("compatibility");
      expect(issues[0].message).toContain("max 500");
    });
  });

  // ── validateAllowedTools ─────────────────────────────────────────────────

  describe("validateAllowedTools", () => {
    it("passes when not provided", () => {
      expect(validateAllowedTools(undefined)).toEqual([]);
    });

    it("passes when null", () => {
      expect(validateAllowedTools(null)).toEqual([]);
    });

    it("passes for a valid space-delimited string", () => {
      expect(validateAllowedTools("Bash(git:*) Bash(jq:*) Read")).toEqual([]);
    });

    it("passes for a single tool", () => {
      expect(validateAllowedTools("Read")).toEqual([]);
    });

    it("fails for non-string value", () => {
      const issues = validateAllowedTools(["Read", "Write"]);
      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("allowed-tools");
      expect(issues[0].message).toContain("must be a string");
    });

    it("fails for empty string", () => {
      const issues = validateAllowedTools("");
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("must not be empty");
    });
  });

  // ── trigger overlap disambiguation checks ────────────────────────────────

  describe("trigger overlap disambiguation", () => {
    it("extracts trigger phrases from WHEN/USE FOR sections", () => {
      const description = "Deploy workloads. WHEN: deploy to Azure, host on Azure. USE FOR: modernize app, create API.";
      expect(extractTriggerPhrases(description)).toEqual([
        "deploy to azure",
        "host on azure",
        "modernize app",
        "create api",
      ]);
    });

    it("detects DO NOT USE FOR clause", () => {
      expect(hasDoNotUseForClause("WHEN: deploy. DO NOT USE FOR: generic apps.")).toBe(true);
      expect(hasDoNotUseForClause("WHEN: deploy")).toBe(false);
    });

    it("detects PREFER OVER clause for a competing skill", () => {
      expect(hasPreferOverClause("PREFER OVER azure-prepare when Copilot SDK markers exist.", "azure-prepare")).toBe(true);
      expect(hasPreferOverClause("PREFER OVER azure-deploy when publishing.", "azure-prepare")).toBe(false);
    });

    it("warns when a non-broad skill overlaps broad triggers without disambiguation", () => {
      const issues = validateTriggerOverlapDisambiguation(
        {
          name: "specialized-skill",
          file: "/tmp/specialized/SKILL.md",
          description: "WHEN: deploy to Azure, host on Azure, copilot sdk",
          triggerPhrases: ["deploy to azure", "host on azure", "copilot sdk"],
          broad: false,
        },
        [
          {
            name: "specialized-skill",
            file: "/tmp/specialized/SKILL.md",
            description: "WHEN: deploy to Azure, host on Azure, copilot sdk",
            triggerPhrases: ["deploy to azure", "host on azure", "copilot sdk"],
            broad: false,
          },
          {
            name: "azure-prepare",
            file: "/tmp/azure-prepare/SKILL.md",
            description: "WHEN: deploy to Azure, host on Azure, modernize app, create API",
            triggerPhrases: ["deploy to azure", "host on azure", "modernize app", "create api"],
            broad: true,
          },
        ],
      );

      expect(issues).toHaveLength(1);
      expect(issues[0].check).toBe("trigger-overlap-disambiguation");
    });

    it("does not warn when overlap includes disambiguation", () => {
      const issues = validateTriggerOverlapDisambiguation(
        {
          name: "specialized-skill",
          file: "/tmp/specialized/SKILL.md",
          description: "PREFER OVER azure-prepare. WHEN: deploy to Azure, host on Azure",
          triggerPhrases: ["deploy to azure", "host on azure"],
          broad: false,
        },
        [
          {
            name: "specialized-skill",
            file: "/tmp/specialized/SKILL.md",
            description: "PREFER OVER azure-prepare. WHEN: deploy to Azure, host on Azure",
            triggerPhrases: ["deploy to azure", "host on azure"],
            broad: false,
          },
          {
            name: "azure-prepare",
            file: "/tmp/azure-prepare/SKILL.md",
            description: "WHEN: deploy to Azure, host on Azure",
            triggerPhrases: ["deploy to azure", "host on azure"],
            broad: true,
          },
        ],
      );

      expect(issues).toEqual([]);
    });

    it("detects disambiguation clause removal", () => {
      expect(
        isDisambiguationClauseRemoved(
          "PREFER OVER azure-prepare when copilot sdk markers exist.",
          "WHEN: deploy to Azure, copilot sdk",
        ),
      ).toBe(true);

      expect(
        isDisambiguationClauseRemoved(
          "DO NOT USE FOR: generic web apps",
          "DO NOT USE FOR: generic web apps",
        ),
      ).toBe(false);
    });
  });

  // ── validateSkillFile (integration) ──────────────────────────────────────

  describe("validateSkillFile", () => {
    it("passes for a valid SKILL.md", () => {
      const skillDir = resolve(TEST_DIR, "valid-skill");
      mkdirSync(skillDir, { recursive: true });

      writeFileSync(
        resolve(skillDir, "SKILL.md"),
        '---\nname: valid-skill\ndescription: "Deploy apps to Azure. WHEN: deploy, host, publish."\nlicense: MIT\nmetadata:\n  author: Microsoft\n  version: "1.0.0"\n---\n\n# Valid Skill\n',
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
        '---\nname: correct-name\ndescription: "Some description."\nlicense: MIT\nmetadata:\n  version: "1.0.0"\n---\n\n# Skill\n',
      );

      const result = validateSkillFile(resolve(skillDir, "SKILL.md"));
      expect(result.issues.some((i) => i.message.includes("does not match parent directory"))).toBe(true);
    });

    it("passes when name matches parent directory", () => {
      const skillDir = resolve(TEST_DIR, "matching-name");
      mkdirSync(skillDir, { recursive: true });

      writeFileSync(
        resolve(skillDir, "SKILL.md"),
        '---\nname: matching-name\ndescription: "Some description."\nlicense: MIT\nmetadata:\n  version: "1.0.0"\n---\n\n# Skill\n',
      );

      const result = validateSkillFile(resolve(skillDir, "SKILL.md"));
      expect(result.issues.some((i) => i.message.includes("does not match parent directory"))).toBe(false);
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

    it("catches description exceeding 1024 chars", () => {
      const skillDir = resolve(TEST_DIR, "long-desc");
      mkdirSync(skillDir, { recursive: true });

      const longDesc = "a".repeat(1025);
      writeFileSync(
        resolve(skillDir, "SKILL.md"),
        `---\nname: long-desc\ndescription: "${longDesc}"\nlicense: MIT\nmetadata:\n  version: "1.0.0"\n---\n\n# Skill\n`,
      );

      const result = validateSkillFile(resolve(skillDir, "SKILL.md"));
      expect(result.issues.some((i) => i.check === "description-length")).toBe(true);
    });

    it("catches invalid compatibility field", () => {
      const skillDir = resolve(TEST_DIR, "bad-compat");
      mkdirSync(skillDir, { recursive: true });

      const longCompat = "a".repeat(501);
      writeFileSync(
        resolve(skillDir, "SKILL.md"),
        `---\nname: bad-compat\ndescription: "Some description."\ncompatibility: "${longCompat}"\nlicense: MIT\nmetadata:\n  version: "1.0.0"\n---\n\n# Skill\n`,
      );

      const result = validateSkillFile(resolve(skillDir, "SKILL.md"));
      expect(result.issues.some((i) => i.check === "compatibility")).toBe(true);
    });

    it("passes with valid optional fields", () => {
      const skillDir = resolve(TEST_DIR, "full-skill");
      mkdirSync(skillDir, { recursive: true });

      writeFileSync(
        resolve(skillDir, "SKILL.md"),
        '---\nname: full-skill\ndescription: "Deploy apps to Azure. WHEN: deploy, host."\nlicense: MIT\ncompatibility: "Requires docker and git"\nallowed-tools: "Bash(git:*) Read"\nmetadata:\n  author: Microsoft\n  version: "1.0.0"\n---\n\n# Full Skill\n',
      );

      const result = validateSkillFile(resolve(skillDir, "SKILL.md"));
      expect(result.issues.filter((i) => i.severity !== "warning")).toEqual([]);
    });
  });
});
