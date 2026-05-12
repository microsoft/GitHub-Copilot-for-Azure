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

    test("has Workflow with all 9 steps in table format", () => {
      expect(skill.content).toMatch(/## Workflow/);
      for (let i = 1; i <= 9; i++) {
        expect(skill.content).toMatch(new RegExp(`\\|\\s*${i}\\s*\\|\\s*\\*\\*`));
      }
    });

  });

  // ── Workflow Step Coverage ───────────────────────────────────

  describe("Workflow Steps", () => {
    test.each([
      "Read upstream artifacts",
      "Check validation state",
      "Run preflight checks",
      "Deploy approval gate",
      "Resolve deployment variables",
      "deploy-result.json skeleton",
      "Execute deployment",
      "Deploy application code",
      "Health-check endpoints",
      "Finalize artifacts",
      "Error handling + healing",
    ])("workflow covers: %s", (step) => {
      expect(skill.content.toLowerCase()).toContain(step.toLowerCase());
    });
  });

  // ── Reference Files ──────────────────────────────────────────

  describe("Reference Files", () => {
    const allRefs = [
      "approval-gate-template.md",
      "code-deployment-appservice.md",
      "code-deployment-container-apps.md",
      "code-deployment-swa.md",
      "deploy-safety.md",
      "error-classification.md",
      "health-check-patterns.md",
      "portal-links.md",
      "preflight-checks.md",
    ];

    test.each(allRefs)("reference file exists and is linked: %s", (filename) => {
      expect(existsSync(path.join(SKILL_DIR, "references", filename))).toBe(true);
      expect(skill.content).toContain(filename);
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
    test("deploy gate must be inline markdown, not ask_user", () => {
      expect(skill.content).toMatch(/do NOT use.*ask_user/i);
    });

    test("deploy-result.json must ALWAYS be written regardless of outcome", () => {
      expect(skill.content).toMatch(/ALWAYS write.*deploy-result\.json/i);
    });

    test("audit log must be incremental, not batched", () => {
      expect(skill.content).toMatch(/Audit log.*INCREMENTAL/i);
      expect(skill.content).toMatch(/Do NOT defer to phase exit/i);
    });

    test("healing loop: ask after 3 attempts, then every 5", () => {
      expect(skill.content).toMatch(/after 3 attempts/i);
    });

    test("artifact writes must be distributed, not batched", () => {
      expect(skill.content).toMatch(/DISTRIBUTED.*not batched/i);
    });

    test("references deploy-safety.md for shell and secret rules", () => {
      expect(skill.content).toMatch(/Read.*deploy-safety\.md/i);
      expect(skill.content).toMatch(/shell execution rules.*sync vs async/i);
      expect(skill.content).toMatch(/secret generation patterns/i);
      const safety = readFileSync(path.join(SKILL_DIR, "references", "deploy-safety.md"), "utf-8");
      expect(safety).toMatch(/NEVER use async\/background shells/i);
      expect(safety).toMatch(/Generate secrets ONCE/i);
      expect(safety).toMatch(/az webapp deploy.*does NOT support.*--track-status/i);
    });

    test("post-compaction re-read rule exists", () => {
      expect(skill.content).toMatch(/Post-compaction.*re-read.*deploy-checklist\.md/i);
    });

    test("return to orchestrator — do not start new phases", () => {
      expect(skill.content).toMatch(/return.*control.*azure-app-onboard/i);
    });
  });

  // ── Session Schema Links ─────────────────────────────────────

  describe("Session Schema Links", () => {
    test("links to session-schemas-deploy.ts and exports required interfaces", () => {
      expect(skill.content).toContain("session-schemas-deploy.ts");
      const schemas = readFileSync(path.join(PARENT_REFS, "session-schemas-deploy.ts"), "utf-8");
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
