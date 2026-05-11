/**
 * Unit Tests for azure-app-onboard-prereq
 *
 * Tests isolated skill logic, metadata, required sections,
 * reference file existence, and session-schema linkage.
 */

import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkill, type LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-app-onboard-prereq";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_FILE = path.resolve(
  __dirname,
  "../../plugin/skills/azure-app-onboard-prereq/SKILL.md",
);
const REFERENCES_DIR = path.resolve(
  __dirname,
  "../../plugin/skills/azure-app-onboard-prereq/references",
);
const SESSION_SCHEMAS = path.resolve(
  __dirname,
  "../../plugin/skills/azure-app-onboard/references/session-schemas.ts",
);

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;
  let raw: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    raw = readFileSync(SKILL_FILE, "utf-8");
  });

  // ── Metadata ─────────────────────────────────────────────────

  describe("Skill Metadata", () => {
    test("SKILL.md exists and is non-empty", () => {
      expect(existsSync(SKILL_FILE)).toBe(true);
      expect(raw.length).toBeGreaterThan(100);
    });

    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description is concise and actionable", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
    });

    test("description contains WHEN trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
    });

    test("frontmatter has name, description, license, metadata", () => {
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata).toHaveProperty("license");
      expect(skill.metadata).toHaveProperty("metadata");
    });
  });

  // ── Required Sections ────────────────────────────────────────

  describe("Required Sections", () => {
    test("has When NOT to Use section", () => {
      expect(skill.content).toMatch(/## When NOT to Use/);
    });

    test("has Rules section", () => {
      expect(skill.content).toMatch(/## Rules/);
    });

    test("has MCP Tools section", () => {
      expect(skill.content).toMatch(/## MCP Tools/);
    });

    test("has Workflow section", () => {
      expect(skill.content).toMatch(/## Workflow/);
    });

    test("has Verdicts section", () => {
      expect(skill.content).toMatch(/## Verdicts/);
    });

    test("has Outputs section", () => {
      expect(skill.content).toMatch(/## Outputs/);
    });
  });

  // ── Workflow Coverage ────────────────────────────────────────

  describe("Workflow Steps", () => {
    const workflowSteps = [
      "Session Check",
      "Scan Workspace",
      "Per-Component Evaluation",
      "Build check",
      "Completeness check",
      "Deployability check",
      "Write Artifacts",
      "Readiness Gate",
      "Present Findings",
      "Remediation",
    ];

    test.each(workflowSteps)(
      "workflow covers: %s",
      (step) => {
        const lower = skill.content.toLowerCase();
        const target = step.toLowerCase();
        expect(lower).toContain(target);
      },
    );
  });

  // ── Key Rules ────────────────────────────────────────────────

  describe("Key Rules", () => {
    test("prohibits npm install and npm test", () => {
      expect(skill.content).toContain("npm install");
      expect(skill.content).toContain("npm test");
      expect(skill.content).toMatch(/NEVER allowed/i);
    });

    test("requires read-only by default", () => {
      expect(skill.content).toMatch(/Read-only by default/i);
    });

    test("limits to max 3 questions", () => {
      expect(skill.content).toContain("Max 3 questions");
    });
  });

  // ── Redirect Table ───────────────────────────────────────────

  describe("Redirect Skills", () => {
    test("references competing skills in When NOT to Use", () => {
      expect(skill.content).toContain("azure-validate");
      expect(skill.content).toContain("azure-prepare");
      expect(skill.content).toContain("azure-app-onboard");
      expect(skill.content).toContain("azure-deploy");
    });
  });

  // ── Reference Files ──────────────────────────────────────────

  describe("Reference Files", () => {
    const expectedRefs = [
      "build-check.md",
      "completeness-check.md",
      "deployability-check.md",
      "readiness-gate.md",
      "remediation-protocol.md",
      "zero-code-path.md",
    ];

    test.each(expectedRefs)(
      "reference file exists: %s",
      (filename) => {
        const refPath = path.join(REFERENCES_DIR, filename);
        expect(existsSync(refPath)).toBe(true);
      },
    );

    test("body links to core reference files", () => {
      const coreRefs = [
        "build-check.md",
        "completeness-check.md",
        "deployability-check.md",
        "readiness-gate.md",
      ];
      for (const ref of coreRefs) {
        expect(skill.content).toContain(ref);
      }
    });
  });

  // ── Session Artifacts ────────────────────────────────────────

  describe("Session Artifacts", () => {
    test("references context.json", () => {
      expect(skill.content).toContain("context.json");
    });

    test("references prereq-output.json", () => {
      expect(skill.content).toContain("prereq-output.json");
    });

    test("references session-schemas.ts", () => {
      expect(skill.content).toContain("session-schemas.ts");
    });

    test("session-schemas.ts exists in parent skill", () => {
      expect(existsSync(SESSION_SCHEMAS)).toBe(true);
    });
  });

  // ── Verdicts ─────────────────────────────────────────────────

  describe("Verdicts", () => {
    test("defines PASS, WARN, FAIL verdicts", () => {
      expect(skill.content).toContain("PASS");
      expect(skill.content).toContain("WARN");
      expect(skill.content).toContain("FAIL");
    });
  });

  // ── Frontmatter Formatting ───────────────────────────────────

  describe("Frontmatter Formatting", () => {
    test("frontmatter has no tabs", () => {
      const frontmatter = raw.split("---")[1];
      expect(frontmatter).not.toMatch(/\t/);
    });

    test("frontmatter keys are only supported attributes", () => {
      const frontmatter = raw.split("---")[1];
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
