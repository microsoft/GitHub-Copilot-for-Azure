/**
 * Unit Tests for azure-app-onboard (parent orchestrator)
 *
 * Tests: metadata, required sections, workflow step coverage,
 * reference file completeness, critical safety rules,
 * sub-skill delegation, session-schema linkage.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkill, type LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-app-onboard";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, "../../plugin/skills/azure-app-onboard");

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;
  let raw: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    raw = readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf-8");
  });

  // ── Metadata ─────────────────────────────────────────────────

  describe("Skill Metadata", () => {
    test("frontmatter has name, description, license, metadata", () => {
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(1000);
      expect(skill.metadata).toHaveProperty("license");
      expect(skill.metadata).toHaveProperty("metadata");
    });

    test("description contains WHEN trigger phrase", () => {
      expect(skill.metadata.description).toContain("WHEN:");
    });
  });

  // ── Required Sections ────────────────────────────────────────

  describe("Required Sections", () => {
    test("has Quick Reference, When to Use, When NOT to Use", () => {
      expect(skill.content).toMatch(/## Quick Reference/);
      expect(skill.content).toMatch(/## When to Use/);
      expect(skill.content).toMatch(/## When NOT to Use/);
    });

    test("has Pipeline Rules section with mandatory read instruction", () => {
      expect(skill.content).toMatch(/## Pipeline Rules/);
      expect(skill.content).toMatch(/MUST read.*pipeline-rules\.md/i);
    });

    test("has Workflow with all 10 steps in table format", () => {
      expect(skill.content).toMatch(/## Workflow/);
      for (let i = 1; i <= 10; i++) {
        expect(skill.content).toMatch(new RegExp(`\\|\\s*${i}\\s*\\|`));
      }
    });

    test("has Error Handling and Sub-Skills sections", () => {
      expect(skill.content).toMatch(/## Error Handling/);
      expect(skill.content).toMatch(/## Sub-Skills/);
    });
  });

  // ── Workflow Step Coverage ───────────────────────────────────

  describe("Workflow Steps", () => {
    test.each([
      "Session check",
      "Gather intent",
      "Prereq scan",
      "Refine intent",
      "Plan architecture",
      "Scaffold approval gate",
      "Scaffold",
      "Deploy approval gate",
      "Deploy",
      "Handoff",
    ])("workflow covers: %s", (step) => {
      expect(skill.content).toContain(`**${step}`);
    });

    test("workflow references context.json session file", () => {
      expect(skill.content).toContain("context.json");
    });
  });

  // ── Reference Files ──────────────────────────────────────────

  describe("Reference Files", () => {
    const allRefs = readdirSync(path.join(SKILL_DIR, "references"))
      .filter(f => f.endsWith(".md"));

    test.each(allRefs)("reference file exists: %s", (filename) => {
      expect(existsSync(path.join(SKILL_DIR, "references", filename))).toBe(true);
    });

    test("body links to key reference files", () => {
      expect(skill.content).toContain("pipeline-rules.md");
      expect(skill.content).toContain("approval-gates.md");
      expect(skill.content).toContain("handoff-protocol.md");
      expect(skill.content).toContain("session-protocol.md");
      expect(skill.content).toContain("intent-gathering.md");
    });
  });

  // ── Session Schema Files ─────────────────────────────────────

  describe("Session Schema Files", () => {
    test.each([
      "session-schemas.ts",
      "session-schemas-prepare.ts",
      "session-schemas-deploy.ts",
    ])("schema file exists: %s", (filename) => {
      expect(existsSync(path.join(SKILL_DIR, "references", filename))).toBe(true);
    });
  });

  // ── Sub-Skill Delegation ─────────────────────────────────────

  describe("Sub-Skill Delegation", () => {
    test("mandatory read rule before sub-skill execution", () => {
      expect(skill.content).toMatch(/MUST read the corresponding sub-skill document/i);
    });

    test.each([
      ["prereq", "{\"skill\": \"azure-app-onboard-prereq\"}"],
      ["prepare", "prepare/SKILL.md"],
      ["scaffold", "scaffold/SKILL.md"],
      ["deploy", "deploy/SKILL.md"],
    ])("sub-skill %s references %s", (_name, ref) => {
      expect(skill.content).toContain(ref);
    });

    test("sub-skill SKILL.md files exist on disk", () => {
      expect(existsSync(path.resolve(SKILL_DIR, "../azure-app-onboard-prereq/SKILL.md"))).toBe(true);
      expect(existsSync(path.join(SKILL_DIR, "prepare/SKILL.md"))).toBe(true);
      expect(existsSync(path.join(SKILL_DIR, "scaffold/SKILL.md"))).toBe(true);
      expect(existsSync(path.join(SKILL_DIR, "deploy/SKILL.md"))).toBe(true);
    });
  });

  // ── Critical Safety Rules (⛔) ──────────────────────────────

  describe("Critical Safety Rules", () => {
    test("pipeline-rules.md must be read at session start", () => {
      expect(skill.content).toMatch(/MUST read.*pipeline-rules\.md.*start of every/i);
    });

    test("handoff-protocol.md must be read at Step 10", () => {
      expect(skill.content).toMatch(/MUST read.*handoff-protocol\.md/i);
    });

    test("approval gates are separate for scaffold and deploy", () => {
      expect(skill.content).toContain("Scaffold approval gate");
      expect(skill.content).toContain("Deploy approval gate");
      expect(skill.content).toMatch(/SEPARATE gate/i);
    });

    test("When NOT to Use routes to correct alternative skills", () => {
      expect(skill.content).toContain("azure-deploy");
      expect(skill.content).toContain("azure-cost");
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
