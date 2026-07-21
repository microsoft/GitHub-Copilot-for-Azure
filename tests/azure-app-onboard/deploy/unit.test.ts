/**
 * Unit Tests for azure-app-onboard/deploy subskill
 *
 * Tests: metadata, required sections, workflow step coverage,
 * reference file completeness, critical safety rules,
 * session-schema linkage, error classification.
 */

import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkill, type LoadedSkill } from "../../utils/skill-loader";

const SUBSKILL_NAME = "deploy";
const SKILL_PATH = `azure-app-onboard/${SUBSKILL_NAME}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, "../../../plugin/skills/azure-app-onboard/deploy");

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
      expect(skill.content).toContain("prepare-plan.json");
      expect(skill.content).toContain("scaffold-manifest.json");
      expect(skill.content).toContain("deploy-result.json");
    });

    test("has When to Use, When NOT to Use with routing alternatives", () => {
      expect(skill.content).toMatch(/## When to Use/);
      expect(skill.content).toMatch(/## When NOT to Use/);
      expect(skill.content).toContain("azure-deploy");
    });

    test("has Workflow with expected step IDs (0,1,3,4,5b,6,6b,7,8,9) in table format", () => {
      expect(skill.content).toMatch(/## Workflow/);
      for (const step of ["0", "1", "3", "4", "5b", "6", "6b", "7", "8", "9"]) {
        expect(skill.content).toMatch(new RegExp(`\\|\\s*${step}\\s*\\|\\s*\\*\\*`));
      }
    });

  });

  // ── Workflow Step Coverage ───────────────────────────────────

  describe("Workflow Steps", () => {
    test.each([
      "Dispatch preflight sub-agent",
      "Read upstream artifacts",
      "Preflight checks",
      "Deploy approval gate",
      "deploy-result.json skeleton",
      "Execute deployment",
      "Deploy application code",
      "Health-check",
      "Finalize artifacts",
      "Error handling + healing",
    ])("workflow covers: %s", (step) => {
      expect(skill.content.toLowerCase()).toContain(step.toLowerCase());
    });
  });

  // ── Reference Files ──────────────────────────────────────────

  describe("Reference Files", () => {
    const directRefs = [
      "deploy-checklist-template.md",
      "deploy-schemas.ts",
      "error-classification.md",
      "subagent-preflight.md",
    ];

    const delegatedRefs = [
      "approval-gate-template.md",
      "code-deployment-appservice.md",
      "code-deployment-container-apps.md",
      "code-deployment-swa.md",
      "deploy-safety.md",
      "health-check-patterns.md",
      "preflight-checks.md",
    ];

    test.each(directRefs)("reference file exists and is linked in SKILL.md: %s", (filename) => {
      expect(existsSync(path.join(SKILL_DIR, "references", filename))).toBe(true);
      expect(skill.content).toContain(filename);
    });

    test.each(delegatedRefs)("reference file exists on disk (delegated to sub-agent): %s", (filename) => {
      expect(existsSync(path.join(SKILL_DIR, "references", filename))).toBe(true);
    });

    test("error-classification.md contains all three error categories", () => {
      const refContent = readFileSync(path.join(SKILL_DIR, "references", "error-classification.md"), "utf-8");
      expect(refContent).toContain("IAC_ERROR");
      expect(refContent).toContain("INFRA_TRANSIENT");
      expect(refContent).toContain("ENVIRONMENT_BLOCKING");
    });
  });

  // ── Critical Safety Rules (⛔) ──────────────────────────────

  describe("Critical Safety Rules", () => {
    test("NEVER ask_user for passwords — auto-generate secure params", () => {
      expect(skill.content).toMatch(/NEVER.*ask_user.*password/i);
    });

    test("deploy-result.json must exist before first az command and on failure", () => {
      expect(skill.content).toMatch(/Must exist BEFORE first.*az.*command/i);
      expect(skill.content).toMatch(/write.*deploy-result\.json.*with.*status.*failed/i);
    });

    test("healing loop: ask after 3 attempts, then every 5", () => {
      expect(skill.content).toMatch(/after 3 attempts/i);
    });

    test("deploy-safety.md exists with shell and secret rules", () => {
      const safety = readFileSync(path.join(SKILL_DIR, "references", "deploy-safety.md"), "utf-8");
      expect(safety).toMatch(/Use sync shells/i);
      expect(safety).toMatch(/generate each secret ONCE/i);
    });

    test("compaction re-read rule for deploy-checklist.md", () => {
      expect(skill.content).toMatch(/compaction/i);
      expect(skill.content).toMatch(/re-read.*deploy-checklist\.md/i);
    });

    test("return to orchestrator — do not start new phases", () => {
      expect(skill.content).toMatch(/return.*control.*azure-app-onboard/i);
    });
  });

  // ── Session Schema Links ─────────────────────────────────────

  describe("Session Schema Links", () => {
    test("links to deploy-schemas.ts and exports required interfaces", () => {
      expect(skill.content).toContain("deploy-schemas.ts");
      const schemas = readFileSync(path.join(SKILL_DIR, "references", "deploy-schemas.ts"), "utf-8");
      expect(schemas).toContain("export interface DeployResult");
      expect(schemas).toContain("export interface DeployHealingAttempt");
    });
  });

  // ── Frontmatter Formatting ───────────────────────────────────

  describe("Frontmatter Formatting", () => {
    test("frontmatter has no tabs", () => {
      expect(raw.split("---")[1]).not.toMatch(/\t/);
    });
  });
});
