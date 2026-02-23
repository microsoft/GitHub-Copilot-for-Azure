/**
 * Unit Tests for diagnose-429-errors
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
  "../../../../plugin/skills/microsoft-foundry/troubleshooting/diagnose-429-errors.md"
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

describe("diagnose-429-errors - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(() => {
    skill = loadTroubleshootingSkill();
  });

  describe("Skill Metadata", () => {
    test("has valid frontmatter with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("diagnose-429-errors");
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

    test("description mentions key error types", () => {
      const desc = skill.metadata.description;
      expect(desc).toContain("429");
      expect(desc).toContain("rate limit");
      expect(desc).toContain("TPM");
      expect(desc).toContain("RPM");
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

    test("contains Understanding Rate Limiting section", () => {
      expect(skill.content).toContain("## Understanding Rate Limiting");
    });

    test("documents limit types", () => {
      expect(skill.content).toContain("TPM (Tokens Per Minute)");
      expect(skill.content).toContain("RPM (Requests Per Minute)");
      expect(skill.content).toContain("Concurrent Requests");
      expect(skill.content).toContain("Burst Limits");
    });

    test("explains Regional Quota vs Deployment Allocation", () => {
      expect(skill.content).toContain("Regional Quota vs Deployment Allocation");
      expect(skill.content).toContain("Regional Quota");
      expect(skill.content).toContain("Deployment Allocation");
    });
  });

  describe("Diagnostic Workflow", () => {
    test("contains all diagnostic steps", () => {
      expect(skill.content).toContain("### Step 0: Gather Resource Context");
      expect(skill.content).toContain("### Step 1: Check Deployment Rate Limits");
      expect(skill.content).toContain("### Step 2: Check Regional Quota");
      expect(skill.content).toContain("### Step 3: Analyze Error Patterns");
      expect(skill.content).toContain("### Step 4: Implement Retry Logic");
      expect(skill.content).toContain("### Step 5: Present Solutions to User");
      expect(skill.content).toContain("### Step 6: Execute Chosen Solution");
    });

    test("references MCP tools in workflow steps", () => {
      expect(skill.content).toContain("azure__foundry");
      expect(skill.content).toContain("azure__monitor");
      expect(skill.content).toContain("azure__quota");
    });

    test("contains CLI fallback commands", () => {
      expect(skill.content).toContain("az cognitiveservices");
      expect(skill.content).toContain("az monitor log-analytics query");
    });

    test("documents rateLimits as critical check", () => {
      expect(skill.content).toContain("rateLimits");
      expect(skill.content).toContain("sku.capacity");
    });

    test("documents AskUserQuestion for solution selection", () => {
      expect(skill.content).toContain("AskUserQuestion");
    });
  });

  describe("Common Issues & Quick Fixes", () => {
    test("contains common issues table", () => {
      expect(skill.content).toContain("## Common Issues & Quick Fixes");
    });

    test("covers key troubleshooting scenarios", () => {
      expect(skill.content).toContain("Constant 429 errors");
      expect(skill.content).toContain("Intermittent 429s");
      expect(skill.content).toContain("429 with low usage");
      expect(skill.content).toContain("429 but quota available");
    });

    test("contains diagnostic checklist", () => {
      expect(skill.content).toContain("## Diagnostic Checklist");
    });
  });

  describe("References", () => {
    test("links to reference files", () => {
      expect(skill.content).toContain("references/sku-types.md");
      expect(skill.content).toContain("references/RETRY_EXAMPLES.md");
      expect(skill.content).toContain("references/scaling-strategies.md");
      expect(skill.content).toContain("references/solution-selection.md");
    });

    test("contains bash code blocks", () => {
      expect(skill.content).toContain("```bash");
    });
  });
});
