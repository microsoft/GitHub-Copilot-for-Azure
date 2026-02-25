/**
 * Unit Tests for foundry-agent
 *
 * Test isolated skill logic and validation rules for the
 * foundry-agent sub-skill SKILL.md and its reference files.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSkill, LoadedSkill } from "../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/foundry-agent";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_DIR = path.resolve(
  __dirname,
  "../../../plugin/skills/microsoft-foundry/foundry-agent"
);

describe("foundry-agent - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("foundry-agent");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("name matches directory", () => {
      expect(skill.metadata.name).toBe("foundry-agent");
    });

    test("description is within spec limits", () => {
      // Description must be 1-1024 characters per skill spec
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
    });

    test("description contains USE FOR triggers", () => {
      expect(skill.metadata.description).toMatch(/USE FOR:/i);
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      expect(skill.metadata.description).toMatch(/DO NOT USE FOR:/i);
    });

    test("description covers key agent operations", () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toContain("create agent");
      expect(desc).toContain("deploy agent");
      expect(desc).toContain("invoke agent");
      expect(desc).toContain("troubleshoot agent");
    });
  });

  describe("Skill Content - Required Sections", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains Agent Types section", () => {
      expect(skill.content).toContain("## Agent Types");
    });

    test("documents prompt and hosted agent types", () => {
      expect(skill.content).toContain("Prompt");
      expect(skill.content).toContain("Hosted");
      expect(skill.content).toContain('"prompt"');
      expect(skill.content).toContain('"hosted"');
    });

    test("contains Agent Development Lifecycle section", () => {
      expect(skill.content).toContain("## Agent Development Lifecycle");
    });

    test("contains Project Context Resolution section", () => {
      expect(skill.content).toContain("## Project Context Resolution");
    });

    test("contains MCP Tools section", () => {
      expect(skill.content).toContain("## MCP Tools");
    });

    test("contains References section", () => {
      expect(skill.content).toContain("## References");
    });

    test("contains Error Handling section", () => {
      expect(skill.content).toContain("## Error Handling");
    });
  });

  describe("MCP Tools", () => {
    test("lists foundry_agents MCP tools", () => {
      expect(skill.content).toContain("foundry_agents_list");
      expect(skill.content).toContain("foundry_agents_connect");
      expect(skill.content).toContain("foundry_agents_create");
      expect(skill.content).toContain("foundry_agents_update");
      expect(skill.content).toContain("foundry_agents_delete");
    });

    test("prefers MCP over SDK", () => {
      expect(skill.content).toMatch(/MCP.*first|MCP.*prefer/i);
    });
  });

  describe("Lifecycle Routing", () => {
    test("references create-prompt workflow", () => {
      expect(skill.content).toContain("create/create-prompt.md");
    });

    test("references create-hosted workflow", () => {
      expect(skill.content).toContain("create/create.md");
    });

    test("references deploy workflow", () => {
      expect(skill.content).toContain("deploy/deploy.md");
    });

    test("references invoke workflow", () => {
      expect(skill.content).toContain("invoke/invoke.md");
    });

    test("references troubleshoot workflow", () => {
      expect(skill.content).toContain("troubleshoot/troubleshoot.md");
    });
  });

  describe("Reference Files Exist", () => {
    const referenceFiles = [
      "create/create-prompt.md",
      "create/create.md",
      "deploy/deploy.md",
      "invoke/invoke.md",
      "troubleshoot/troubleshoot.md",
      "create/references/sdk-operations.md",
      "create/references/agent-tools.md",
      "create/references/tool-web-search.md",
      "create/references/tool-bing-grounding.md",
      "create/references/tool-memory.md",
      "create/references/tool-azure-ai-search.md",
      "create/references/tool-mcp.md",
      "create/references/agentframework.md",
    ];

    test.each(referenceFiles)(
      "reference file exists: %s",
      (file) => {
        const fullPath = path.join(SKILL_DIR, file);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    );
  });

  describe("Create-Prompt Reference Content", () => {
    let createPromptContent: string;

    beforeAll(() => {
      createPromptContent = fs.readFileSync(
        path.join(SKILL_DIR, "create/create-prompt.md"),
        "utf-8"
      );
    });

    test("has substantive content", () => {
      expect(createPromptContent).toBeDefined();
      expect(createPromptContent.length).toBeGreaterThan(100);
    });

    test("documents MCP-first workflow", () => {
      expect(createPromptContent).toContain("MCP");
      expect(createPromptContent).toContain("foundry_agents_");
    });

    test("documents SDK fallback", () => {
      expect(createPromptContent).toContain("SDK");
      expect(createPromptContent).toContain("sdk-operations.md");
    });

    test("documents agent tool categories", () => {
      expect(createPromptContent).toContain("Code Interpreter");
      expect(createPromptContent).toContain("Web Search");
      expect(createPromptContent).toContain("Azure AI Search");
      expect(createPromptContent).toContain("MCP");
      expect(createPromptContent).toContain("Memory");
    });

    test("contains error handling", () => {
      expect(createPromptContent).toContain("Error Handling");
    });

    test("links to hosted agent create for non-prompt agents", () => {
      expect(createPromptContent).toContain("create.md");
    });
  });
});
