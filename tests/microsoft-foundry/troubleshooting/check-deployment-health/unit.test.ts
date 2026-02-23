/**
 * Unit Tests for check-deployment-health
 * 
 * Test isolated skill logic and validation rules.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { LoadedSkill } from "../../../utils/skill-loader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILL_FILE = path.resolve(
  __dirname,
  "../../../../plugin/skills/microsoft-foundry/troubleshooting/check-deployment-health.md"
);

function loadTroubleshootingSkill(): LoadedSkill {
  const fileContent = fs.readFileSync(SKILL_FILE, "utf-8");
  const { data: metadata, content } = matter(fileContent);
  return {
    metadata: {
      name: metadata.name as string,
      description: metadata.description as string,
      ...metadata,
    },
    content: content.trim(),
    path: path.dirname(SKILL_FILE),
    filePath: SKILL_FILE,
  };
}

describe("check-deployment-health - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(() => {
    skill = loadTroubleshootingSkill();
  });

  describe("Skill Metadata", () => {
    test("has valid frontmatter with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("check-deployment-health");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description is appropriately sized", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR triggers", () => {
      expect(skill.metadata.description).toMatch(/USE FOR:/i);
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      expect(skill.metadata.description).toMatch(/DO NOT USE FOR:/i);
    });

    test("description mentions key health concepts", () => {
      const desc = skill.metadata.description;
      expect(desc).toContain("deployment health");
      expect(desc).toContain("deployment failed");
      expect(desc).toContain("provisioning");
    });

    test("description references MCP tools", () => {
      expect(skill.metadata.description).toContain("INVOKES:");
      expect(skill.metadata.description).toContain("azure__foundry");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test("contains Quick Reference section", () => {
      expect(skill.content).toContain("## Quick Reference");
    });

    test("contains When to Use section", () => {
      expect(skill.content).toContain("## When to Use");
    });

    test("contains Understanding Deployment Health section", () => {
      expect(skill.content).toContain("## Understanding Deployment Health");
    });

    test("documents provisioning states", () => {
      expect(skill.content).toContain("### Provisioning States");
      expect(skill.content).toContain("Succeeded");
      expect(skill.content).toContain("Creating");
      expect(skill.content).toContain("Failed");
      expect(skill.content).toContain("Updating");
      expect(skill.content).toContain("Deleting");
      expect(skill.content).toContain("Canceled");
    });

    test("documents health indicators", () => {
      expect(skill.content).toContain("### Health Indicators");
      expect(skill.content).toContain("Provisioning State");
      expect(skill.content).toContain("Endpoint Latency");
      expect(skill.content).toContain("Error Rate");
      expect(skill.content).toContain("Availability");
    });
  });

  describe("Diagnostic Workflow", () => {
    test("contains all diagnostic steps", () => {
      expect(skill.content).toContain("### Step 1: Check Deployment Provisioning State");
      expect(skill.content).toContain("### Step 2: Verify Endpoint Health");
      expect(skill.content).toContain("### Step 3: Check Azure Monitor Metrics");
      expect(skill.content).toContain("### Step 4: Query Deployment Logs");
      expect(skill.content).toContain("### Step 5: Analyze Deployment Errors");
      expect(skill.content).toContain("### Step 6: Present Remediation Options");
    });

    test("references MCP tools in workflow steps", () => {
      expect(skill.content).toContain("azure__foundry");
      expect(skill.content).toContain("azure__monitor");
    });

    test("contains CLI fallback commands", () => {
      expect(skill.content).toContain("az cognitiveservices account deployment show");
      expect(skill.content).toContain("az monitor metrics list");
      expect(skill.content).toContain("az monitor log-analytics query");
    });

    test("documents AskUserQuestion for remediation", () => {
      expect(skill.content).toContain("AskUserQuestion");
    });
  });

  describe("Common Issues & Quick Fixes", () => {
    test("contains common issues table", () => {
      expect(skill.content).toContain("## Common Issues & Quick Fixes");
    });

    test("covers key troubleshooting scenarios", () => {
      expect(skill.content).toContain('Stuck in "Creating"');
      expect(skill.content).toContain("InsufficientQuota");
      expect(skill.content).toContain("ModelNotFound");
      expect(skill.content).toContain("Endpoint timeout");
      expect(skill.content).toContain("5xx errors");
    });

    test("contains diagnostic checklist", () => {
      expect(skill.content).toContain("## Diagnostic Checklist");
    });

    test("contains When to Escalate section", () => {
      expect(skill.content).toContain("## When to Escalate");
    });
  });

  describe("References", () => {
    test("links to reference files", () => {
      expect(skill.content).toContain("references/deployment-states.md");
      expect(skill.content).toContain("references/health-indicators.md");
      expect(skill.content).toContain("references/solution-selection.md");
    });

    test("contains bash code blocks", () => {
      expect(skill.content).toContain("```bash");
    });

    test("contains Kusto query example", () => {
      expect(skill.content).toContain("```kusto");
      expect(skill.content).toContain("AzureDiagnostics");
    });
  });
});
