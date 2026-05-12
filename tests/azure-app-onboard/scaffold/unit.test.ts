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
      "deployment-summary.md",
      "self-review",
      "self-healing",
      "approval gate",
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
    const allRefs = [
      "bicep-patterns.md",
      "terraform-patterns.md",
      "bicep-app-service.md",
      "bicep-container-apps.md",
      "bicep-patterns-data.md",
      "iac-generation-rules.md",
      "self-review-procedure.md",
      "self-review-checklist.md",
      "waf-checklist.md",
      "validation-and-manifest.md",
      "scaffold-healing-rules.md",
      "self-healing.md",
      "error-handling.md",
    ];

    test.each(allRefs)("reference file exists and is linked: %s", (filename) => {
      expect(existsSync(path.join(SKILL_DIR, "references", filename))).toBe(true);
      expect(skill.content).toContain(filename);
    });
  });

  // ── Critical Safety Rules (⛔) ──────────────────────────────

  describe("Critical Safety Rules", () => {
    test("do NOT auto-force Terraform — prepare phase owns IaC format", () => {
      expect(skill.content).toMatch(/Do NOT auto-force Terraform/i);
    });

    test("must read iac-generation-rules.md before generating IaC", () => {
      expect(skill.content).toMatch(/MUST read.*iac-generation-rules\.md/i);
    });

    test("file boundary rule: never modify files outside infra/", () => {
      expect(skill.content).toMatch(/NEVER modify files outside.*infra/i);
    });

    test("do not rewrite app source or run package installs", () => {
      expect(skill.content).toMatch(/Do NOT rewrite app source/i);
    });

    test("return to orchestrator — do not directly invoke deploy", () => {
      expect(skill.content).toMatch(/Do NOT directly invoke deploy/i);
    });
  });

  // ── Session Schema Links ─────────────────────────────────────

  describe("Session Schema Links", () => {
    test("session-schemas-deploy.ts exports ScaffoldManifest interface", () => {
      const schemas = readFileSync(path.join(PARENT_REFS, "session-schemas-deploy.ts"), "utf-8");
      expect(schemas).toContain("ScaffoldManifest");
    });
  });

  // ── MCP Tool References ──────────────────────────────────────

  describe("MCP Tool References", () => {
    test.each([
      "mcp_azure_mcp_bicepschema",
      "mcp_azure_mcp_azureterraformbestpractices",
      "deploy_iac_rules_get",
      "mcp_bicep_get_bicep_file_diagnostics",
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
