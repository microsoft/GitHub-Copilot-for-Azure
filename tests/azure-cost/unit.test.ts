/**
 * Unit Tests for azure-cost
 *
 * Test isolated skill logic and validation rules.
 * Covers shared structure, metadata, and content for all three
 * sub-areas: Cost Query, Cost Forecast, and Cost Optimization.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost";

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

    test("description is concise and actionable", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(1000);
    });

    test("description contains trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      const hasTriggerPhrases =
        description.includes("use this") ||
        description.includes("use when") ||
        description.includes("helps") ||
        description.includes("activate") ||
        description.includes("trigger") ||
        description.includes("when:");
      expect(hasTriggerPhrases).toBe(true);
    });
  });

  describe("Skill Content Structure", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(1000);
    });

    test("contains Quick Reference section", () => {
      expect(skill.content).toMatch(/## Quick Reference/i);
    });

    test("contains When to Use This Skill section", () => {
      expect(skill.content).toMatch(/## When to Use This Skill/i);
    });

    test("contains MCP Tools section", () => {
      expect(skill.content).toMatch(/## MCP Tools/i);
    });

    test("contains Error Handling section", () => {
      expect(skill.content).toMatch(/## Error Handling/i);
    });

    test("contains Guardrails section", () => {
      expect(skill.content).toMatch(/Guardrails/i);
    });

    test("contains Best Practices section", () => {
      expect(skill.content).toMatch(/## Best Practices/i);
    });

    test("contains Safety Requirements section", () => {
      expect(skill.content).toMatch(/## Safety Requirements/i);
    });

    test("contains Common Pitfalls section", () => {
      expect(skill.content).toMatch(/## Common Pitfalls/i);
      expect(skill.content).toContain("free tier");
    });
  });

  describe("MCP Tool References", () => {
    test("references azure__documentation tool", () => {
      expect(skill.content).toContain("azure__documentation");
    });

    test("references azure__extension_cli_generate tool", () => {
      expect(skill.content).toContain("azure__extension_cli_generate");
    });

    test("references azure__get_azure_bestpractices tool", () => {
      expect(skill.content).toContain("azure__get_azure_bestpractices");
    });
  });

  describe("Scope Reference", () => {
    test("references scopes", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/subscription/);
      expect(content).toMatch(/resource group/);
      expect(content).toMatch(/billing account/);
    });
  });

  describe("Data Classification", () => {
    test("includes data classification guidance", () => {
      expect(skill.content).toContain("ACTUAL DATA");
      expect(skill.content).toContain("ESTIMATED");
      expect(skill.content).toContain("VALIDATED");
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
      const supported = ["name", "description", "compatibility", "license", "metadata",
        "argument-hint", "disable-model-invocation", "user-invokable"];
      const keys = frontmatter.split("\n")
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
  });

  // --- Cost Query (Part 1) ---
  describe("Cost Query Workflow", () => {
    test("description contains cost-query-related keywords", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/cost|query|spend|breakdown|actual|amortized/);
    });

    test("contains Cost Query Workflow section", () => {
      expect(skill.content).toMatch(/## Part 1: Cost Query Workflow/i);
    });

    test("references Cost Management Query API endpoint", () => {
      expect(skill.content).toMatch(/Microsoft\.CostManagement\/query/);
    });

    test("mentions key guardrails", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/granularity/);
      expect(content).toMatch(/date range/);
      expect(content).toMatch(/groupby/i);
    });
  });

  // --- Cost Forecast (Part 3) ---
  describe("Cost Forecast Workflow", () => {
    test("description contains forecast-related keywords", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/forecast|predict|project|estimate|future/);
    });

    test("contains Cost Forecast Workflow section", () => {
      expect(skill.content).toMatch(/## Part 3: Cost Forecast Workflow/i);
    });

    test("references forecast API endpoint", () => {
      expect(skill.content).toMatch(/Microsoft\.CostManagement\/forecast|forecast\s+API/i);
    });

    test("mentions to-date must be in the future", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/future|must be in the future/);
    });

    test("mentions grouping not supported", () => {
      const content = skill.content.toLowerCase();
      expect(content).toContain("grouping");
      expect(content).toMatch(/not supported/);
    });

    test("mentions includeActualCost field", () => {
      expect(skill.content).toContain("includeActualCost");
    });

    test("mentions minimum training data requirement", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/training data|28 days/);
    });

    test("references CostStatus or response types", () => {
      expect(skill.content).toMatch(/CostStatus|("Actual".*"Forecast"|Actual.*Forecast)/);
    });
  });

  // --- Cost Optimization (Part 2) ---
  describe("Cost Optimization Workflow", () => {
    test("description contains optimization-related keywords", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/orphaned|rightsize|unused/);
    });

    test("contains Cost Optimization Workflow section", () => {
      expect(skill.content).toMatch(/## Part 2: Cost Optimization Workflow/i);
    });

    test("documents step-by-step instructions", () => {
      expect(skill.content).toMatch(/### Step \d+:/);
    });

    test("includes prerequisites validation", () => {
      expect(skill.content).toMatch(/### Step 0: Validate Prerequisites/i);
      expect(skill.content).toContain("Azure CLI");
      expect(skill.content).toContain("azqr");
    });

    test("includes cost query instructions", () => {
      expect(skill.content).toMatch(/### Step \d+: Query Actual Costs/i);
      expect(skill.content).toContain("Cost Management API");
      expect(skill.content).toContain("ActualCost");
    });

    test("includes report generation step", () => {
      expect(skill.content).toMatch(/### Step \d+: Generate Optimization Report/i);
      expect(skill.content).toContain("output/");
      expect(skill.content).toContain("costoptimizereport");
    });
  });

  describe("Azure Quick Review", () => {
    test("mentions Azure Quick Review (azqr)", () => {
      expect(skill.content).toContain("azqr");
      expect(skill.content).toContain("Azure Quick Review");
      expect(skill.content).toMatch(/orphaned resources/i);
    });

    test("documents azqr installation", () => {
      expect(skill.content).toContain("azqr");
      expect(skill.content).toMatch(/azqr version/i);
    });
  });

  describe("Required Tools and Extensions", () => {
    test("documents Azure CLI requirement", () => {
      expect(skill.content).toContain("az login");
      expect(skill.content).toMatch(/Azure CLI/i);
    });

    test("lists required Azure CLI extensions", () => {
      expect(skill.content).toContain("costmanagement");
      expect(skill.content).toContain("resource-graph");
    });

    test("documents required permissions", () => {
      expect(skill.content).toMatch(/Cost Management Reader/i);
      expect(skill.content).toMatch(/Monitoring Reader/i);
      expect(skill.content).toMatch(/Reader role/i);
    });
  });

  describe("Cost Analysis Features", () => {
    test("mentions orphaned resources", () => {
      expect(skill.content).toMatch(/orphaned resources/i);
      expect(skill.content).toMatch(/unattached disks|unused NICs/i);
    });

    test("mentions rightsizing", () => {
      expect(skill.content).toMatch(/rightsize|rightsizing/i);
      expect(skill.content).toMatch(/VM|virtual machines/i);
    });

    test("mentions utilization metrics", () => {
      expect(skill.content).toContain("Azure Monitor");
      expect(skill.content).toMatch(/utilization|metrics/i);
      expect(skill.content).toContain("Percentage CPU");
    });

    test("includes pricing validation", () => {
      expect(skill.content).toMatch(/### Step \d+: Validate Pricing/i);
      expect(skill.content).toContain("azure.microsoft.com/pricing");
    });
  });

  describe("Output and Reporting", () => {
    test("defines output folder convention", () => {
      expect(skill.content).toContain("output/");
      expect(skill.content).toMatch(/costoptimizereport.*\.md/);
    });

    test("references report template", () => {
      expect(skill.content).toContain("report-template.md");
    });

    test("documents audit trail", () => {
      expect(skill.content).toContain("audit trail");
      expect(skill.content).toContain("cost-query-result");
      expect(skill.content).toMatch(/\.json/);
    });

    test("references Redis-specific optimization", () => {
      expect(skill.content).toContain("Redis");
      expect(skill.content).toContain("azure-cache-for-redis.md");
    });
  });

  describe("Azure Resource Graph Integration", () => {
    test("links to Azure Resource Graph reference", () => {
      expect(skill.content).toContain("cost-optimization/azure-resource-graph.md");
    });

    test("mentions Resource Graph for resource discovery", () => {
      expect(skill.content).toContain("Azure Resource Graph");
    });
  });
});
