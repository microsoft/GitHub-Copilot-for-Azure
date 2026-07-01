/**
 * Unit Tests for azure-app-onboard/prepare subskill
 *
 * Tests: metadata, required sections, workflow step coverage,
 * reference file completeness, critical safety rules,
 * session-schema linkage, MCP tool references.
 */

import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkill, type LoadedSkill } from "../../utils/skill-loader";

const SUBSKILL_NAME = "prepare";
const SKILL_PATH = `azure-app-onboard/${SUBSKILL_NAME}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, "../../../plugin/skills/azure-app-onboard/prepare");

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

    test("description does NOT contain routing phrases", () => {
      const desc = skill.metadata.description;
      expect(desc).not.toMatch(/\bUSE FOR\b/);
      expect(desc).not.toMatch(/\bWHEN:/);
      expect(desc).not.toMatch(/\bPREFER\b/);
      expect(desc).not.toMatch(/\bDO NOT USE FOR\b/);
    });
  });

  // ── Required Sections ────────────────────────────────────────

  describe("Required Sections", () => {
    test("has Quick Reference table with inputs and outputs", () => {
      expect(skill.content).toMatch(/## Quick Reference/);
      expect(skill.content).toContain("prereq-output.json");
      expect(skill.content).toContain("prepare-plan.json");
    });

    test("has When to Use, When NOT to Use, and MCP Tools sections", () => {
      expect(skill.content).toMatch(/## When to Use/);
      expect(skill.content).toMatch(/## When NOT to Use/);
      expect(skill.content).toMatch(/## MCP Tools/);
    });

    test("has Workflow with all 11 steps in table format", () => {
      expect(skill.content).toMatch(/## Workflow/);
      for (let i = 1; i <= 11; i++) {
        expect(skill.content).toMatch(new RegExp(`\\|\\s*${i}\\s*\\|\\s*\\*\\*`));
      }
    });

    test("has Step 5 Quota Validation Procedure subsection", () => {
      expect(skill.content).toMatch(/### Step 5/);
    });

    test("has Error Handling section", () => {
      expect(skill.content).toMatch(/## Error Handling/);
    });
  });

  // ── Workflow Step Coverage ───────────────────────────────────

  describe("Workflow Steps", () => {
    test.each([
      "Read session state",
      "Query policy constraints",
      "Map components to services",
      "Select SKUs",
      "Validate quotas",
      "Estimate costs",
      "Generate naming",
      "Determine IaC format",
      "Write prepare-plan.json",
      "Return summary",
      "Validate plan",
    ])("workflow covers: %s", (step) => {
      expect(skill.content.toLowerCase()).toContain(step.toLowerCase());
    });
  });

  // ── Reference Files ──────────────────────────────────────────

  describe("Reference Files", () => {
    const directRefs = [
      "service-mapping.md",
      "deploy-strategy.md",
      "sku-matrix.md",
      "pricing-guide.md",
      "naming-patterns.md",
    ];

    const delegatedRefs = [
      "sku-quota-validation.md",
    ];

    test.each(directRefs)("reference file exists and is linked: %s", (filename) => {
      expect(existsSync(path.join(SKILL_DIR, "references", filename))).toBe(true);
      expect(skill.content).toContain(filename);
    });

    test.each(delegatedRefs)("reference file exists on disk (delegated to sub-agent): %s", (filename) => {
      expect(existsSync(path.join(SKILL_DIR, "references", filename))).toBe(true);
    });
  });

  // ── Critical Safety Rules (⛔) ──────────────────────────────

  describe("Critical Safety Rules", () => {
    test("pricing_get requires --sku when querying by armSkuName", () => {
      expect(skill.content).toMatch(/pricing_get.*use.*--sku/is);
    });

    test("quota anti-patterns: never use az appservice list-locations or mcp_azure_mcp_quota", () => {
      const quotaRef = readFileSync(path.join(SKILL_DIR, "references", "sku-quota-validation.md"), "utf-8");
      expect(quotaRef).toMatch(/az appservice list-locations/i);
      expect(quotaRef).toContain("mcp_azure_mcp_quota");
    });

    test("never present region without checking quota first", () => {
      expect(skill.content).toMatch(/NEVER present a region without checking quota/i);
    });

    test("free does not mean unlimited quota", () => {
      expect(skill.content).toMatch(/Free ≠ unlimited/i);
    });

    test("region fallback must update all services[].region entries", () => {
      expect(skill.content).toMatch(/update ALL.*services\[\]\.region/i);
    });

    test("return to orchestrator — do not directly invoke scaffold", () => {
      expect(skill.content).toMatch(/Do NOT directly invoke scaffold/i);
    });
  });

  // ── Session Schema Links ─────────────────────────────────────

  describe("Session Schema Links", () => {
    test("links to prepare-schemas.ts and exports PreparePlan interface", () => {
      expect(skill.content).toContain("prepare-schemas");
      const schemas = readFileSync(path.join(SKILL_DIR, "references", "prepare-schemas.ts"), "utf-8");
      expect(schemas).toContain("export interface PreparePlan");
    });
  });

  // ── MCP Tool References ──────────────────────────────────────

  describe("MCP Tool References", () => {
    test.each([
      "mcp_azure_mcp_policy",
      "mcp_azure_mcp_advisor",
      "az rest",
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
