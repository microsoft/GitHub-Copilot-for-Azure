/**
 * Unit Tests for azure-infra-planner
 * 
 * Test isolated skill logic, validation rules, and reference data integrity.
 */

import * as fs from "fs";
import * as path from "path";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-infra-planner";

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

    test("description contains USE FOR trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("use for:");
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("do not use for:");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("documents research phase", () => {
      expect(skill.content).toContain("Research");
      expect(skill.content).toContain("microsoft_docs_search");
      expect(skill.content).toContain("microsoft_docs_fetch");
    });

    test("documents plan generation phase", () => {
      expect(skill.content).toContain("Plan Generation");
      expect(skill.content).toContain("infrastructure-plan.json");
    });

    test("documents IaC generation phase", () => {
      expect(skill.content).toContain("IaC Generation");
      expect(skill.content).toContain("Bicep");
      expect(skill.content).toContain("Terraform");
    });

    test("documents deployment phase", () => {
      expect(skill.content).toContain("Deployment");
      expect(skill.content).toContain("az deployment group create");
      expect(skill.content).toContain("terraform apply");
    });

    test("documents status lifecycle", () => {
      expect(skill.content).toContain("Status Lifecycle");
      expect(skill.content).toContain("draft");
      expect(skill.content).toContain("approved");
      expect(skill.content).toContain("deployed");
    });

    test("documents plan-first workflow gate", () => {
      expect(skill.content).toContain("PLAN-FIRST WORKFLOW");
      expect(skill.content).toContain("STOP HERE");
    });

    test("lists all required MCP tools", () => {
      const requiredTools = [
        "microsoft_docs_search",
        "microsoft_docs_fetch",
      ];
      for (const tool of requiredTools) {
        expect(skill.content).toContain(tool);
      }
    });
  });

  describe("Plan-First Workflow", () => {
    test("requires user confirmation before deployment", () => {
      expect(skill.content.toLowerCase()).toContain("approved");
      expect(skill.content.toLowerCase()).toContain("subscription");
    });

    test("has blocking plan requirement", () => {
      expect(skill.content).toContain("PLAN-FIRST");
    });

    test("references plan schema", () => {
      expect(skill.content).toContain("plan-schema.md");
    });

    test("references verification workflow", () => {
      expect(skill.content).toContain("verification.md");
    });
  });

  describe("Reference Data Integrity", () => {
    let referencesDir: string;
    let resourcesDir: string;

    beforeAll(() => {
      referencesDir = path.join(skill.path, "references");
      resourcesDir = path.join(referencesDir, "resources");
    });

    test("references directory exists", () => {
      expect(fs.existsSync(referencesDir)).toBe(true);
    });

    test("required top-level reference files exist", () => {
      const requiredFiles = [
        "resources.md",
        "plan-schema.md",
        "verification.md",
        "research.md",
        "deployment.md",
      ];
      for (const file of requiredFiles) {
        expect(fs.existsSync(path.join(referencesDir, file))).toBe(true);
      }
    });

    test("all 7 resource category directories exist", () => {
      const expectedCategories = [
        "compute", "data", "networking", "messaging",
        "monitoring", "ai", "security"
      ];
      for (const cat of expectedCategories) {
        const catDir = path.join(resourcesDir, cat);
        expect(fs.existsSync(catDir)).toBe(true);
      }
    });

    test("every category has an index.md", () => {
      const categories = fs.readdirSync(resourcesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      for (const cat of categories) {
        const indexPath = path.join(resourcesDir, cat, "index.md");
        expect(fs.existsSync(indexPath)).toBe(true);
      }
    });

    test("every resource subdirectory has required files", () => {
      const categories = fs.readdirSync(resourcesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      
      let resourceCount = 0;
      const missingFiles: string[] = [];

      for (const cat of categories) {
        const catDir = path.join(resourcesDir, cat);
        const resources = fs.readdirSync(catDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);
        
        for (const res of resources) {
          resourceCount++;
          const resDir = path.join(catDir, res);
          const mainFile = path.join(resDir, `${res}.md`);
          const bicepFile = path.join(resDir, "bicep.md");
          const constraintsFile = path.join(resDir, "constraints.md");

          if (!fs.existsSync(mainFile)) missingFiles.push(`${cat}/${res}/${res}.md`);
          if (!fs.existsSync(bicepFile)) missingFiles.push(`${cat}/${res}/bicep.md`);
          if (!fs.existsSync(constraintsFile)) missingFiles.push(`${cat}/${res}/constraints.md`);
        }
      }

      expect(missingFiles).toEqual([]);
      expect(resourceCount).toBe(48);
    });

    test("every resource main file has an Identity section with ARM type and API version", () => {
      const categories = fs.readdirSync(resourcesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      const malformed: string[] = [];

      for (const cat of categories) {
        const catDir = path.join(resourcesDir, cat);
        const resources = fs.readdirSync(catDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);

        for (const res of resources) {
          const mainFile = path.join(catDir, res, `${res}.md`);
          if (!fs.existsSync(mainFile)) continue;
          const content = fs.readFileSync(mainFile, "utf-8");
          if (!content.includes("## Identity")) malformed.push(`${cat}/${res}: missing ## Identity`);
          if (!content.includes("ARM Type")) malformed.push(`${cat}/${res}: missing ARM Type`);
          if (!content.includes("Bicep API Version")) malformed.push(`${cat}/${res}: missing Bicep API Version`);
        }
      }

      expect(malformed).toEqual([]);
    });

    test("every resource main file has a Naming section", () => {
      const categories = fs.readdirSync(resourcesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      const missing: string[] = [];
      for (const cat of categories) {
        const catDir = path.join(resourcesDir, cat);
        const resources = fs.readdirSync(catDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);
        for (const res of resources) {
          const mainFile = path.join(catDir, res, `${res}.md`);
          if (!fs.existsSync(mainFile)) continue;
          const content = fs.readFileSync(mainFile, "utf-8");
          if (!content.includes("## Naming")) missing.push(`${cat}/${res}`);
        }
      }
      expect(missing).toEqual([]);
    });

    test("every bicep.md contains a Bicep resource block", () => {
      const categories = fs.readdirSync(resourcesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      const missing: string[] = [];
      for (const cat of categories) {
        const catDir = path.join(resourcesDir, cat);
        const resources = fs.readdirSync(catDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);
        for (const res of resources) {
          const bicepFile = path.join(catDir, res, "bicep.md");
          if (!fs.existsSync(bicepFile)) continue;
          const content = fs.readFileSync(bicepFile, "utf-8");
          if (!content.includes("resource ")) missing.push(`${cat}/${res}/bicep.md`);
        }
      }
      expect(missing).toEqual([]);
    });

    test("every constraints.md has at least one constraint rule", () => {
      const categories = fs.readdirSync(resourcesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      const empty: string[] = [];
      for (const cat of categories) {
        const catDir = path.join(resourcesDir, cat);
        const resources = fs.readdirSync(catDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);
        for (const res of resources) {
          const file = path.join(catDir, res, "constraints.md");
          if (!fs.existsSync(file)) continue;
          const content = fs.readFileSync(file, "utf-8").trim();
          // Should have more than just a heading
          if (content.split("\n").length < 3) empty.push(`${cat}/${res}/constraints.md`);
        }
      }
      expect(empty).toEqual([]);
    });

    test("resources.md category links all resolve", () => {
      const indexContent = fs.readFileSync(
        path.join(referencesDir, "resources.md"), "utf-8"
      );
      const linkPattern = /\(resources\/([^)]+)\)/g;
      const broken: string[] = [];
      let match;
      while ((match = linkPattern.exec(indexContent)) !== null) {
        const relPath = match[1];
        const fullPath = path.join(referencesDir, "resources", relPath);
        if (!fs.existsSync(fullPath)) broken.push(relPath);
      }
      expect(broken).toEqual([]);
    });

    test("category index links all resolve to resource files", () => {
      const categories = fs.readdirSync(resourcesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      const broken: string[] = [];
      for (const cat of categories) {
        const indexPath = path.join(resourcesDir, cat, "index.md");
        if (!fs.existsSync(indexPath)) continue;
        const content = fs.readFileSync(indexPath, "utf-8");
        const linkPattern = /\(([^)]+\.md)\)/g;
        let match;
        while ((match = linkPattern.exec(content)) !== null) {
          const relPath = match[1];
          const fullPath = path.join(resourcesDir, cat, relPath);
          if (!fs.existsSync(fullPath)) broken.push(`${cat}/index.md -> ${relPath}`);
        }
      }
      expect(broken).toEqual([]);
    });

    test("no resource main file exceeds 1100 tokens", () => {
      const categories = fs.readdirSync(resourcesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      const oversized: string[] = [];
      for (const cat of categories) {
        const catDir = path.join(resourcesDir, cat);
        const resources = fs.readdirSync(catDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);
        for (const res of resources) {
          const mainFile = path.join(catDir, res, `${res}.md`);
          if (!fs.existsSync(mainFile)) continue;
          const content = fs.readFileSync(mainFile, "utf-8");
          const estTokens = Math.round(content.length / 4);
          if (estTokens > 1100) oversized.push(`${cat}/${res}: ${estTokens} tokens`);
        }
      }
      expect(oversized).toEqual([]);
    });
  });
});
