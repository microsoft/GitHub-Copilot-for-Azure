/**
 * Unit Tests for azure-project-plan
 *
 * Test isolated skill logic and validation rules.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-project-plan";

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
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
    });

    test("description contains WHEN trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("when:");
    });

    test("has license field set to MIT", () => {
      expect(skill.metadata.license).toBe("MIT");
    });

    test("has metadata.author set to Microsoft", () => {
      const meta = skill.metadata.metadata as Record<string, unknown>;
      expect(meta).toBeDefined();
      expect(meta.author).toBe("Microsoft");
    });

    test("has metadata.version in semver format", () => {
      const meta = skill.metadata.metadata as Record<string, unknown>;
      expect(meta.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test("description mentions azure-project-scaffold chain", () => {
      expect(skill.metadata.description).toContain("azure-project-scaffold");
    });

    test("description mentions .azure/project-plan.md output", () => {
      expect(skill.metadata.description).toContain(".azure/project-plan.md");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(skill.content).toContain("## Triggers");
      expect(skill.content).toContain("## Rules");
    });

    test("contains DO NOT Activate When section", () => {
      expect(skill.content).toContain("DO NOT Activate When");
    });

    test("contains Outputs section", () => {
      expect(skill.content).toContain("## Outputs");
    });

    test("contains Next section for auto-chain", () => {
      expect(skill.content).toContain("## Next");
    });
  });

  describe("Triggers", () => {
    test("lists key activation scenarios", () => {
      const lowerContent = skill.content.toLowerCase();
      expect(lowerContent).toContain("plan new");
      expect(lowerContent).toContain("design app");
      expect(lowerContent).toContain("new project from scratch");
    });

    test("DO NOT Activate table references correct redirect skills", () => {
      expect(skill.content).toContain("azure-project-scaffold");
      expect(skill.content).toContain("azure-local-development");
      expect(skill.content).toContain("azure-project-verify");
      expect(skill.content).toContain("azure-prepare");
    });
  });

  describe("Plan-First Workflow", () => {
    test("references project-plan.md output file", () => {
      expect(skill.content).toContain(".azure/project-plan.md");
    });

    test("references vscode_askQuestions tool for interactive UI", () => {
      expect(skill.content).toContain("vscode_askQuestions");
    });

    test("documents auto-chain to azure-project-scaffold", () => {
      expect(skill.content).toContain("azure-project-scaffold");
    });

    test("enforces plan-first rule before any code generation", () => {
      const lowerContent = skill.content.toLowerCase();
      expect(lowerContent).toContain("plan first");
    });

    test("contains plan template structure", () => {
      expect(skill.content).toContain("## 1. Project Overview");
      expect(skill.content).toContain("## 2. Runtime & Framework");
    });

    test("defines all 11 plan template sections", () => {
      expect(skill.content).toContain("## 1. Project Overview");
      expect(skill.content).toContain("## 2. Runtime & Framework");
      expect(skill.content).toContain("## 3. Test Runner & Configuration");
      expect(skill.content).toContain("## 4. Services Required");
      expect(skill.content).toContain("## 5. Project Structure");
      expect(skill.content).toContain("## 6. Route Definitions");
      expect(skill.content).toContain("## 7. Database Constraints");
      expect(skill.content).toContain("## 8. Service Dependency Classification");
      expect(skill.content).toContain("## 9. Execution Checklist");
      expect(skill.content).toContain("## 10. Files to Generate");
      expect(skill.content).toContain("## 11. Next Steps");
    });

    test("enforces ONLY .azure/project-plan.md before approval", () => {
      expect(skill.content).toMatch(
        /ONLY file allowed.*\.azure\/project-plan\.md/i
      );
    });

    test("requires plan approval before auto-chaining", () => {
      const lowerContent = skill.content.toLowerCase();
      expect(lowerContent).toContain("approval");
      expect(lowerContent).toContain("approved");
    });
  });

  describe("Workflow Steps", () => {
    test("defines Step 1: Detect Workspace", () => {
      expect(skill.content).toContain("Step 1: Detect Workspace");
    });

    test("defines Step 2: Gather Requirements", () => {
      expect(skill.content).toContain("Step 2: Gather Requirements");
    });

    test("defines Step 3: Generate Plan", () => {
      expect(skill.content).toContain("Step 3:");
    });

    test("workspace scan checks for package.json, host.json, and other signals", () => {
      expect(skill.content).toContain("package.json");
      expect(skill.content).toContain("host.json");
      expect(skill.content).toContain("local.settings.json");
    });

    test("workspace scan checks for Python and .NET project files", () => {
      expect(skill.content).toContain("pyproject.toml");
      expect(skill.content).toContain(".csproj");
    });
  });

  describe("Requirements Gathering", () => {
    test("documents workspace scanning step", () => {
      const lowerContent = skill.content.toLowerCase();
      expect(lowerContent).toMatch(/scan|detect|workspace/);
    });

    test("includes inference rules for existing projects", () => {
      const lowerContent = skill.content.toLowerCase();
      expect(lowerContent).toContain("infer");
    });

    test("documents service classification (Essential vs Enhancement)", () => {
      expect(skill.content).toContain("Essential");
      expect(skill.content).toContain("Enhancement");
    });

    test("inference rules cover major Azure SDKs", () => {
      expect(skill.content).toContain("@azure/storage-blob");
      expect(skill.content).toContain("@azure/cosmos");
    });

    test("inference rules cover major frontend frameworks", () => {
      expect(skill.content).toContain("react");
      expect(skill.content).toContain("vue");
      expect(skill.content).toContain("@angular/core");
      expect(skill.content).toContain("svelte");
    });

    test("inference rules cover test runners", () => {
      expect(skill.content).toContain("vitest");
      expect(skill.content).toContain("jest");
      expect(skill.content).toContain("mocha");
    });

    test("documents vscode_askQuestions question definitions", () => {
      expect(skill.content).toContain("Q1: App Type");
      expect(skill.content).toContain("Q2: Runtime");
      expect(skill.content).toContain("Q3: Data Stores");
    });

    test("provides example vscode_askQuestions JSON invocation", () => {
      expect(skill.content).toContain('"questions"');
      expect(skill.content).toContain('"header"');
      expect(skill.content).toContain('"allowFreeformInput"');
    });
  });

  describe("Planning Quick Reference", () => {
    test("includes service-to-environment-variable mapping table", () => {
      expect(skill.content).toContain("Service-to-Environment-Variable Mapping");
      expect(skill.content).toContain("STORAGE_CONNECTION_STRING");
      expect(skill.content).toContain("DATABASE_URL");
      expect(skill.content).toContain("COSMOSDB_CONNECTION_STRING");
      expect(skill.content).toContain("REDIS_URL");
    });

    test("documents Essential vs Enhancement classification table", () => {
      expect(skill.content).toContain("Essential vs Enhancement Classification");
      expect(skill.content).toMatch(/Essential.*Request cannot succeed/);
      expect(skill.content).toMatch(/Enhancement.*Request can succeed/);
    });

    test("defines error response contract with error codes", () => {
      expect(skill.content).toContain("Error Response Contract");
      expect(skill.content).toContain("VALIDATION_ERROR");
      expect(skill.content).toContain("NOT_FOUND");
      expect(skill.content).toContain("INTERNAL_ERROR");
    });

    test("includes canonical project structure", () => {
      expect(skill.content).toContain("Canonical Project Structure");
      expect(skill.content).toContain("functions/");
      expect(skill.content).toContain("interfaces/");
      expect(skill.content).toContain("registry.ts");
    });

    test("documents architecture core principles", () => {
      expect(skill.content).toContain("Architecture Core Principles");
      expect(skill.content).toContain("Service boundary isolation");
      expect(skill.content).toContain("Dependency injection");
    });
  });

  describe("Rules", () => {
    test("has at least 4 rules", () => {
      const ruleMatches = skill.content.match(/^\d+\.\s+\*\*/gm);
      expect(ruleMatches).not.toBeNull();
      expect(ruleMatches!.length).toBeGreaterThanOrEqual(4);
    });

    test("rule 1 is plan-first", () => {
      expect(skill.content).toMatch(/1\..*Plan first/i);
    });

    test("rule 2 is resilience classification", () => {
      expect(skill.content).toMatch(/2\..*Resilience classification/i);
    });

    test("rule 3 is auto-chain after approval", () => {
      expect(skill.content).toMatch(/3\..*Auto-chain/i);
    });

    test("rule 4 is interactive UI", () => {
      expect(skill.content).toMatch(/4\..*Interactive UI/i);
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
        "name", "description", "compatibility", "license", "metadata",
        "argument-hint", "disable-model-invocation", "user-invokable",
      ];
      const keys = frontmatter
        .split("\n")
        .filter((l: string) => /^[a-z][\w-]*\s*:/.test(l))
        .map((l: string) => l.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });

    test("WHEN clause is inside description", () => {
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
    });

    test("name in frontmatter matches directory name", () => {
      expect(skill.metadata.name).toBe(SKILL_NAME);
    });
  });
});
