/**
 * Unit Tests for check-model-availability
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
  "../../../../plugin/skills/microsoft-foundry/troubleshooting/check-model-availability.md"
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

describe("check-model-availability - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(() => {
    skill = loadTroubleshootingSkill();
  });

  describe("Skill Metadata", () => {
    test("has valid frontmatter with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("check-model-availability");
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

    test("description mentions key availability concepts", () => {
      const desc = skill.metadata.description;
      expect(desc).toContain("model availability");
      expect(desc).toContain("region");
      expect(desc).toContain("model not found");
    });

    test("description references tooling", () => {
      expect(skill.metadata.description).toContain("INVOKES:");
      expect(skill.metadata.description).toContain("Capacity discovery scripts");
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

    test("contains Understanding Availability section", () => {
      expect(skill.content).toContain("## Understanding Availability");
    });

    test("documents availability factors", () => {
      expect(skill.content).toContain("Region");
      expect(skill.content).toContain("SKU Type");
      expect(skill.content).toContain("Version");
      expect(skill.content).toContain("Capacity");
    });
  });

  describe("Diagnostic Workflow", () => {
    test("contains all diagnostic steps", () => {
      expect(skill.content).toContain("### Step 1: Get Subscription Context FIRST");
      expect(skill.content).toContain("### Step 2: Check User's Actual Quota");
      expect(skill.content).toContain("### Step 3: Quick Catalog Check with MCP");
      expect(skill.content).toContain("### Step 4: Multi-Region Discovery");
      expect(skill.content).toContain("### Step 5: Detailed Quota Check");
      expect(skill.content).toContain("### Step 6: Present Options to User");
    });

    test("references MCP tools in workflow steps", () => {
      expect(skill.content).toContain("azure__foundry");
      expect(skill.content).toContain("azure__quota");
    });

    test("contains CLI fallback commands", () => {
      expect(skill.content).toContain("az cognitiveservices usage list");
    });

    test("documents AskUserQuestion for option presentation", () => {
      expect(skill.content).toContain("AskUserQuestion");
    });
  });

  describe("Six Reasons for Unavailability", () => {
    test("contains six reasons section", () => {
      expect(skill.content).toContain("## Six Reasons for Unavailability");
    });

    test("documents all six reasons", () => {
      expect(skill.content).toContain("Not in subscription");
      expect(skill.content).toContain("Not in region");
      expect(skill.content).toContain("SKU not supported");
      expect(skill.content).toContain("No quota");
      expect(skill.content).toContain("Version unavailable");
      expect(skill.content).toContain("Deployment type constraint");
    });
  });

  describe("Common Issues & Quick Fixes", () => {
    test("contains common issues table", () => {
      expect(skill.content).toContain("## Common Issues & Quick Fixes");
    });

    test("covers key troubleshooting scenarios", () => {
      expect(skill.content).toContain('"Model not found" error');
      expect(skill.content).toContain("Version unavailable");
      expect(skill.content).toContain('"SKU not available" error');
    });

    test("contains diagnostic checklist", () => {
      expect(skill.content).toContain("## Diagnostic Checklist");
    });
  });

  describe("Regional Information", () => {
    test("contains regional capacity considerations", () => {
      expect(skill.content).toContain("## Regional Capacity Considerations");
    });

    test("mentions key Azure regions", () => {
      expect(skill.content).toContain("East US");
      expect(skill.content).toContain("West Europe");
      expect(skill.content).toContain("Southeast Asia");
    });

    test("mentions multi-region strategy", () => {
      expect(skill.content).toContain("Multi-Region Strategy");
    });
  });

  describe("References", () => {
    test("links to reference files", () => {
      expect(skill.content).toContain("references/model-availability-flow.md");
    });

    test("contains bash code blocks", () => {
      expect(skill.content).toContain("```bash");
    });
  });
});
