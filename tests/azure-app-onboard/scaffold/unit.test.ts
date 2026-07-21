/**
 * Unit Tests for azure-app-onboard/scaffold subskill
 *
 * Tests: metadata, required sections, workflow step coverage,
 * reference file completeness, critical safety rules,
 * session-schema linkage, MCP tool references.
 */

import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkill, type LoadedSkill } from "../../utils/skill-loader";

const SUBSKILL_NAME = "scaffold";
const SKILL_PATH = `azure-app-onboard/${SUBSKILL_NAME}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, "../../../plugin/skills/azure-app-onboard/scaffold");
const PARENT_REFS = path.resolve(__dirname, "../../../plugin/skills/azure-app-onboard/references");

describe(`${SKILL_PATH} - Unit Tests`, () => {
  let skill: LoadedSkill;
  let raw: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_PATH);
    raw = readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf-8");
  });

  // ── Metadata ─────────────────────────────────────────────────

  describe("Skill Metadata", () => {
    test("frontmatter has name, description, license, metadata", () => {
      expect(skill.metadata.name).toBe(SUBSKILL_NAME);
      expect(skill.metadata.description.length).toBeGreaterThan(10);
      expect(skill.metadata).toHaveProperty("license");
      expect(skill.metadata).toHaveProperty("metadata");
    });

    test("description does NOT contain top-level routing phrases", () => {
      const desc = skill.metadata.description;
      expect(desc).not.toMatch(/\bUSE FOR\b(?!:)/);  // "USE FOR:" in WHEN clause is ok
    });
  });

  // ── Required Sections ────────────────────────────────────────

  describe("Required Sections", () => {
    test("has Quick Reference table with inputs and outputs", () => {
      expect(skill.content).toMatch(/## Quick Reference/);
      expect(skill.content).toContain("prepare-plan.json");
      expect(skill.content).toContain("scaffold-manifest.json");
    });

    test("has When to Use, When NOT to Use, and MCP Tools sections", () => {
      expect(skill.content).toMatch(/## When to Use/);
      expect(skill.content).toMatch(/## When NOT to Use/);
      expect(skill.content).toMatch(/## MCP Tools/);
    });

    test("has Workflow with DETECT, ACTION, VALIDATE phases", () => {
      expect(skill.content).toMatch(/## Workflow/);
      expect(skill.content).toMatch(/### DETECT/);
      expect(skill.content).toMatch(/### ACTION/);
      expect(skill.content).toMatch(/### VALIDATE/);
    });

    test("has Self-Healing Loop and Error Handling sections", () => {
      expect(skill.content).toMatch(/## Self-Healing Loop/);
      expect(skill.content).toMatch(/## Error Handling/);
    });
  });

  // ── Workflow Step Coverage ───────────────────────────────────

  describe("Workflow Steps", () => {
    test.each([
      "prepare-plan.json",
      "context.json",
      "scaffold-manifest.json",
      "self-review",
      "self-healing",
      "approve",
    ])("workflow covers: %s", (concept) => {
      expect(skill.content.toLowerCase()).toContain(concept.toLowerCase());
    });

    test("DETECT phase handles existing IaC routing (Bicep, Terraform, detectedInfraProvider)", () => {
      expect(skill.content).toContain("detectedInfra");
      expect(skill.content).toContain(".bicep");
      expect(skill.content).toContain(".tf");
      expect(skill.content).toContain("detectedInfraProvider");
    });
  });

  // ── Reference Files ──────────────────────────────────────────

  describe("Reference Files", () => {
    // Files directly referenced in SKILL.md body
    const directRefs = [
      "scaffold-healing-rules.md",
      "subagent-iac-gen.md",
      "subagent-review.md",
      "subagent-validate.md",
    ];

    // Files delegated to sub-agent templates (not in SKILL.md body)
    const delegatedRefs: Array<{ file: string; template: string }> = [
      { file: "bicep-patterns.md", template: "subagent-iac-gen.md" },
      { file: "terraform-patterns.md", template: "subagent-iac-gen.md" },
      { file: "bicep-app-service.md", template: "subagent-iac-gen.md" },
      { file: "bicep-container-apps.md", template: "subagent-iac-gen.md" },
      { file: "iac-generation-rules.md", template: "subagent-iac-gen.md" },
      { file: "env-var-secrets.md", template: "subagent-iac-gen.md" },
      { file: "dockerfile-generation.md", template: "subagent-iac-gen.md" },
      { file: "self-review-checklist.md", template: "subagent-review.md" },
      { file: "bicep-patterns-security.md", template: "subagent-review.md" },
      { file: "rbac-roles.md", template: "subagent-review.md" },
      { file: "validation-and-manifest.md", template: "subagent-validate.md" },
      { file: "scaffold-healing-rules.md", template: "subagent-validate.md" },
    ];

    test.each(directRefs)("reference file exists and is linked in SKILL.md: %s", (filename) => {
      expect(existsSync(path.join(SKILL_DIR, "references", filename))).toBe(true);
      expect(skill.content).toContain(filename);
    });

    test.each(delegatedRefs)("reference file exists and is linked in sub-agent template: $file", ({ file, template }) => {
      expect(existsSync(path.join(SKILL_DIR, "references", file))).toBe(true);
      const templateContent = readFileSync(path.join(SKILL_DIR, "references", template), "utf-8");
      expect(templateContent).toContain(file);
    });

    test("SKILL.md references all three sub-agent templates", () => {
      expect(skill.content).toContain("subagent-iac-gen.md");
      expect(skill.content).toContain("subagent-review.md");
      expect(skill.content).toContain("subagent-validate.md");
    });
  });

  // ── Critical Safety Rules (⛔) ──────────────────────────────

  describe("Critical Safety Rules", () => {
    test("IaC format: Bicep default, Terraform when existing .tf detected or user override", () => {
      expect(skill.content).toMatch(/Bicep.*default/i);
      expect(skill.content).toMatch(/Terraform.*when.*\.tf.*detected/i);
    });

    test("iac-generation-rules.md is delegated to IaC sub-agent", () => {
      const template = readFileSync(path.join(SKILL_DIR, "references", "subagent-iac-gen.md"), "utf-8");
      expect(template).toMatch(/read.*iac-generation-rules\.md/i);
    });

    test("file boundary rule: never modify files outside infra/", () => {
      expect(skill.content).toMatch(/NEVER modify files outside.*infra/i);
    });

    test("scaffold only writes files — no install or build commands", () => {
      expect(skill.content).toMatch(/no install.*build commands/i);
    });

    test("return to orchestrator — do not directly invoke deploy", () => {
      expect(skill.content).toMatch(/Do NOT directly invoke deploy/i);
    });
  });

  // ── Session Schema Links ─────────────────────────────────────

  describe("Session Schema Links", () => {
    test("scaffold-schemas.ts exports ScaffoldManifest interface", () => {
      const schemas = readFileSync(path.join(SKILL_DIR, "references", "scaffold-schemas.ts"), "utf-8");
      expect(schemas).toContain("ScaffoldManifest");
    });
  });

  // ── MCP Tool References ──────────────────────────────────────

  describe("MCP Tool References", () => {
    test.each([
      "mcp_azure_mcp_bicepschema",
      "mcp_azure_mcp_azureterraformbestpractices",
      "deploy_iac_rules_get",
      "mcp_bicep_build_bicep",
      "mcp_bicep_list_avm_metadata",
      "deploy_pipeline_guidance_get",
    ])("references tool: %s", (tool) => {
      expect(skill.content).toContain(tool);
    });
  });

  // ── Frontmatter Formatting ───────────────────────────────────

  describe("Frontmatter Formatting", () => {
    test("frontmatter has no tabs and uses only supported keys", () => {
      const frontmatter = raw.split("---")[1];
      expect(frontmatter).not.toMatch(/\t/);
      const supported = [
        "name", "description", "compatibility", "license", "metadata",
        "argument-hint", "disable-model-invocation", "user-invokable",
      ];
      const keys = frontmatter.split("\n")
        .filter((l: string) => /^[a-z][\w-]*\s*:/.test(l))
        .map((l: string) => l.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });
  });
});
