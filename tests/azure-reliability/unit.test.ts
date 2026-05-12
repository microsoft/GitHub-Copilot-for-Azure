/**
 * Unit Tests for azure-reliability
 *
 * Test isolated skill logic and validation rules.
 */

import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-reliability";

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description meets Medium-High compliance length", () => {
      // Descriptions should be 150-1024 chars for Medium-High compliance
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
    });

    test("description contains WHEN trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("when:");
    });

    test("description scopes the skill to Azure Functions", () => {
      const description = skill.metadata.description.toLowerCase();
      const content = skill.content.toLowerCase();
      expect(description).toContain("functions");
      expect(content).toContain("this skill currently covers **azure functions** only");
      expect(description).not.toMatch(
        /reliability posture of azure functions, container apps, and app service/
      );
    });

    test("description mentions core reliability features", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("zone redundancy");
      expect(description).toContain("multi-region");
    });
  });

  describe("Skill Content Structure", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(1000);
    });

    test("contains expected top-level sections", () => {
      expect(skill.content).toContain("## Quick Reference");
      expect(skill.content).toContain("## When to Use This Skill");
      expect(skill.content).toContain("## Prerequisites");
      expect(skill.content).toContain("## Assessment Workflow");
      expect(skill.content).toContain("## Configuration Workflow");
      expect(skill.content).toContain("## Skill Boundaries");
    });

    test("documents the three assessment phases", () => {
      expect(skill.content).toContain("Phase 1: Discover Resources");
      expect(skill.content).toContain("Phase 2: Assess Reliability");
      expect(skill.content).toContain("Phase 3: Generate Reliability Checklist");
    });

    test("documents the configuration workflow steps", () => {
      expect(skill.content).toContain("Step 1: Present Fix Plan");
      expect(skill.content).toContain("Path A: Fix Now (CLI)");
      expect(skill.content).toContain("Path B: Patch IaC");
      expect(skill.content).toContain("Re-Assess");
      expect(skill.content).toContain("Multi-region follow-up");
    });
  });

  describe("Assessment Output Format", () => {
    test("feature-pivoted table contains all four feature rows", () => {
      // The four reliability features must all appear in the assessment table
      expect(skill.content).toContain("Zone redundancy — compute");
      expect(skill.content).toContain("Zone-redundant storage");
      expect(skill.content).toContain("Health probes");
      expect(skill.content).toContain("Multi-region failover");
    });

    test("uses traffic-light status indicators (no scoring)", () => {
      expect(skill.content).toContain("🟢 ON");
      expect(skill.content).toContain("🟡 PARTIAL");
      expect(skill.content).toContain("🔴 OFF");
    });

    test("explicitly forbids numeric scoring", () => {
      // Two anti-scoring statements live in SKILL.md
      expect(skill.content).toContain("Do **not** assign numeric scores");
      expect(skill.content).toContain("include numeric scores, grades, or point totals");
    });

    test("does not contain a /10 score anywhere", () => {
      // Refactored away from "Score: X/10" output
      expect(skill.content).not.toMatch(/\bScore:\s*\d+\/10\b/);
    });
  });

  describe("Staged Remediation (Quick Wins → Storage → Multi-region)", () => {
    test("Path A executes quick wins before storage migration", () => {
      const pathA =
        skill.content
          .split("### Path A: Fix Now (CLI)")[1]
          ?.split("### Path B")[0] ?? "";
      const quickWinsIdx = pathA.indexOf("quick wins first");
      const storageStopIdx = pathA.indexOf("Ask about storage upgrade");
      expect(quickWinsIdx).toBeGreaterThan(-1);
      expect(storageStopIdx).toBeGreaterThan(quickWinsIdx);
    });

    test("Path B uses two-deploy flow with storage SKU isolated", () => {
      expect(skill.content).toContain("Deploy 1");
      expect(skill.content).toContain("Deploy 2");
      expect(skill.content).toContain("storage SKU patch");
    });

    test("multi-region requires explicit user consent", () => {
      const step3 =
        skill.content.split("### Step 3 (both paths): Multi-region")[1] ?? "";
      expect(step3).toContain("ASK and WAIT");
      expect(step3).toContain("yes / no / later");
      expect(step3).toContain("Do not skip the wait");
    });
  });

  describe("Skill Drives Deploys Itself", () => {
    test("documents that the skill executes deployments", () => {
      expect(skill.content).toContain("the skill runs the deploy itself");
    });

    test("Skill Boundaries marks 'Deploy IaC' as Yes", () => {
      const boundaries =
        skill.content.split("## Skill Boundaries")[1] ?? "";
      expect(boundaries).toMatch(
        /Deploy IaC for reliability changes\s*\|\s*✅ Yes/
      );
    });
  });

  describe("FC1 Health Probe Consent Gate", () => {
    test("flags FC1 / Consumption health checks as code-only with consent required", () => {
      expect(skill.content).toContain("FC1 / Consumption");
      expect(skill.content).toContain("Code-only");
      expect(skill.content).toContain("ask the user for explicit consent");
    });
  });

  describe("References", () => {
    let referencesDir: string;

    beforeAll(() => {
      // skill.path points to the built skill directory (output/skills/{skill-name})
      referencesDir = path.join(skill.path, "references");
    });

    const requiredReferences = [
      "zone-redundancy-checks.md",
      "storage-redundancy-checks.md",
      "multi-region-checks.md",
      "health-probe-checks.md",
      "configure-zone-redundancy.md",
      "configure-storage.md",
      "configure-health-probes.md",
      "configure-multi-region.md",
      "iac-patching-bicep.md",
      "iac-patching-terraform.md",
    ];

    test.each(requiredReferences)(
      "shared reference exists: %s",
      (filename) => {
        const fullPath = path.join(referencesDir, filename);
        expect(existsSync(fullPath)).toBe(true);
      }
    );

    test("Functions service reference exists", () => {
      const fullPath = path.join(
        referencesDir,
        "services",
        "functions",
        "reliability.md"
      );
      expect(existsSync(fullPath)).toBe(true);
    });

    test("Functions service reference covers expected sections", () => {
      const fullPath = path.join(
        referencesDir,
        "services",
        "functions",
        "reliability.md"
      );
      const content = readFileSync(fullPath, "utf-8");
      expect(content).toContain("Zone Redundancy");
      expect(content).toContain("Health Endpoint");
      expect(content).toContain("Multi-Region");
      expect(content).toContain("Reporting");
    });
  });

  describe("Frontmatter Formatting", () => {
    test("frontmatter has no tabs", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      const frontmatter = raw.split("---")[1];
      expect(frontmatter).not.toMatch(/\t/);
    });

    test("frontmatter keys are only supported attributes", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      const frontmatter = raw.split("---")[1];
      const supported = [
        "name",
        "description",
        "compatibility",
        "license",
        "metadata",
        "argument-hint",
        "disable-model-invocation",
        "user-invokable",
      ];
      const keys = frontmatter
        .split("\n")
        .filter((l: string) => /^[a-z][\w-]*\s*:/.test(l))
        .map((l: string) => l.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });
  });
});
