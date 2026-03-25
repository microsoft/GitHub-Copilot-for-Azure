/**
 * Cost Optimization Unit Tests for azure-cost
 *
 * Tests specific to the Cost Optimization (Part 2) workflow.
 * Generic skill structure tests are in unit.test.ts.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost";

describe(`${SKILL_NAME} - Cost Optimization Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Description Keywords", () => {
    test("description contains cost optimization triggers", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/cost|spending|optimization|savings/);
    });

    test("description mentions optimization use cases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/orphaned|rightsize|unused/);
    });
  });

  describe("Cost Optimization Workflow", () => {
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
