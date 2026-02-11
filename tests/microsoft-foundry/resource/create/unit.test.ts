/**
 * Unit Tests for microsoft-foundry:resource/create
 *
 * Test isolated skill logic and validation for the resource/create sub-skill.
 * Following progressive disclosure best practices from the skills development guide.
 */

import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";
import * as fs from "fs/promises";
import * as path from "path";

const SKILL_NAME = "microsoft-foundry";

describe("microsoft-foundry:resource/create - Unit Tests", () => {
  let skill: LoadedSkill;
  let resourceCreateContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    const resourceCreatePath = path.join(
      __dirname,
      "../../../../plugin/skills/microsoft-foundry/resource/create/create-foundry-resource.md"
    );
    resourceCreateContent = await fs.readFile(resourceCreatePath, "utf-8");
  });

  describe("Parent Skill Integration", () => {
    test("parent skill references resource/create sub-skill", () => {
      expect(skill.content).toContain("resource/create");
      expect(skill.content).toContain("create-foundry-resource.md");
    });

    test("parent skill description includes resource creation triggers", () => {
      const description = skill.metadata.description;
      expect(description).toContain("USE FOR:");
      expect(description).toMatch(/create Foundry resource|create AI Services|multi-service resource/i);
    });

    test("resource/create is in sub-skills table", () => {
      expect(skill.content).toContain("## Sub-Skills");
      expect(skill.content).toMatch(/\*\*resource\/create\*\*/i);
    });
  });

  describe("Skill Metadata", () => {
    test("has valid frontmatter with required fields", () => {
      expect(resourceCreateContent).toMatch(/^---\n/);
      expect(resourceCreateContent).toContain("name: microsoft-foundry:resource/create");
      expect(resourceCreateContent).toContain("description:");
    });

    test("description includes USE FOR and DO NOT USE FOR", () => {
      expect(resourceCreateContent).toContain("USE FOR:");
      expect(resourceCreateContent).toContain("DO NOT USE FOR:");
    });

    test("description mentions key triggers", () => {
      expect(resourceCreateContent).toMatch(/create Foundry resource|create AI Services|multi-service resource|AIServices kind/i);
    });
  });

  describe("Skill Content - References Pattern", () => {
    test("main file is condensed with links to references", () => {
      expect(resourceCreateContent).toBeDefined();
      const lineCount = resourceCreateContent.split("\n").length;
      // Main file should be under 200 lines for token optimization
      expect(lineCount).toBeLessThan(200);
      // Should link to reference files
      expect(resourceCreateContent).toContain("./references/workflows.md");
      expect(resourceCreateContent).toContain("./references/patterns.md");
      expect(resourceCreateContent).toContain("./references/troubleshooting.md");
    });

    test("contains Quick Reference table", () => {
      expect(resourceCreateContent).toContain("## Quick Reference");
      expect(resourceCreateContent).toContain("Classification");
      expect(resourceCreateContent).toContain("WORKFLOW SKILL");
      expect(resourceCreateContent).toContain("Control Plane");
    });

    test("specifies correct resource type", () => {
      expect(resourceCreateContent).toContain("Microsoft.CognitiveServices/accounts");
      expect(resourceCreateContent).toContain("AIServices");
    });

    test("contains When to Use section", () => {
      expect(resourceCreateContent).toContain("## When to Use");
      expect(resourceCreateContent).toContain("Create Foundry resource");
    });

    test("contains Prerequisites section", () => {
      expect(resourceCreateContent).toContain("## Prerequisites");
      expect(resourceCreateContent).toContain("Azure subscription");
      expect(resourceCreateContent).toContain("Azure CLI");
      expect(resourceCreateContent).toContain("RBAC roles");
    });

    test("references RBAC skill for permissions", () => {
      expect(resourceCreateContent).toContain("microsoft-foundry:rbac");
    });
  });

  describe("Core Workflows", () => {
    test("contains all 3 required workflows", () => {
      expect(resourceCreateContent).toContain("## Core Workflows");
      expect(resourceCreateContent).toContain("### 1. Create Resource Group");
      expect(resourceCreateContent).toContain("### 2. Create Foundry Resource");
      expect(resourceCreateContent).toContain("### 3. Register Resource Provider");
    });

    test("each workflow has command patterns", () => {
      expect(resourceCreateContent).toContain("Create a resource group");
      expect(resourceCreateContent).toContain("Create a new Azure AI Services resource");
      expect(resourceCreateContent).toContain("Register Cognitive Services provider");
    });

    test("workflows use Azure CLI commands", () => {
      expect(resourceCreateContent).toContain("az cognitiveservices account create");
      expect(resourceCreateContent).toContain("az group create");
      expect(resourceCreateContent).toContain("az provider register");
    });

    test("workflows have condensed steps with link to detailed content", () => {
      // Main file has condensed steps, detailed content in references
      expect(resourceCreateContent).toContain("#### Steps");
      expect(resourceCreateContent).toContain("See [Detailed Workflow Steps](./references/workflows.md)");
    });
  });

  describe("Important Notes Section", () => {
    test("explains resource kind requirement", () => {
      expect(resourceCreateContent).toContain("## Important Notes");
      expect(resourceCreateContent).toContain("AIServices");
    });

    test("explains SKU selection", () => {
      expect(resourceCreateContent).toContain("## Important Notes");
      expect(resourceCreateContent).toContain("S0");
    });

    test("mentions key requirements", () => {
      expect(resourceCreateContent).toContain("## Important Notes");
      expect(resourceCreateContent).toMatch(/location|region/i);
    });
  });

  describe("Quick Commands Section", () => {
    test("includes commonly used commands in workflows", () => {
      expect(resourceCreateContent).toContain("az cognitiveservices account create");
      expect(resourceCreateContent).toContain("az group create");
    });

    test("commands include proper parameters", () => {
      expect(resourceCreateContent).toMatch(/--kind AIServices/);
      expect(resourceCreateContent).toMatch(/--resource-group/);
      expect(resourceCreateContent).toMatch(/--name/);
    });

    test("includes verification commands", () => {
      expect(resourceCreateContent).toContain("az cognitiveservices account show");
    });

    test("links to patterns reference with additional commands", () => {
      expect(resourceCreateContent).toContain("./references/patterns.md");
    });
  });

  describe("Troubleshooting Section", () => {
    test("links to troubleshooting reference", () => {
      expect(resourceCreateContent).toContain("./references/troubleshooting.md");
    });

    test("mentions RBAC skill for permission issues", () => {
      expect(resourceCreateContent).toMatch(/microsoft-foundry:rbac/);
    });
  });

  describe("External Resources", () => {
    test("links to Microsoft documentation", () => {
      expect(resourceCreateContent).toContain("## Additional Resources");
      expect(resourceCreateContent).toContain("learn.microsoft.com");
    });

    test("includes relevant Azure docs", () => {
      expect(resourceCreateContent).toMatch(/multi-service resource|Azure AI Services/i);
    });
  });

  describe("Best Practices Compliance", () => {
    test("prioritizes Azure CLI for control plane operations", () => {
      expect(resourceCreateContent).toContain("Primary Method");
      expect(resourceCreateContent).toContain("Azure CLI");
      expect(resourceCreateContent).toContain("Control Plane");
    });

    test("follows skill = how, tools = what pattern", () => {
      expect(resourceCreateContent).toContain("orchestrates");
      expect(resourceCreateContent).toContain("WORKFLOW SKILL");
    });

    test("provides routing clarity", () => {
      expect(resourceCreateContent).toContain("When to Use");
      expect(resourceCreateContent).toContain("Do NOT use for");
    });

    test("follows references pattern for token optimization", () => {
      // Should have condensed content with links to references
      expect(resourceCreateContent).toContain("./references/workflows.md");
      expect(resourceCreateContent).toContain("./references/patterns.md");
      expect(resourceCreateContent).toContain("./references/troubleshooting.md");
      // Main file should be under 200 lines for token limit compliance
      const lineCount = resourceCreateContent.split("\n").length;
      expect(lineCount).toBeLessThan(200);
    });
  });
});
