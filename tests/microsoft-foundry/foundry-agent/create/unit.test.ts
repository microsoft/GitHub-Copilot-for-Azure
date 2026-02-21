/**
 * Unit Tests for create
 * 
 * Test isolated skill logic and validation rules.
 * Tests load the parent microsoft-foundry skill and verify
 * the create.md reference document content directly.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREATE_MD = path.resolve(
  __dirname,
  "../../../../plugin/skills/microsoft-foundry/foundry-agent/create/create.md"
);

describe("create - Unit Tests", () => {
  let skill: LoadedSkill;
  let createContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    createContent = fs.readFileSync(CREATE_MD, "utf-8");
  });

  describe("Parent Skill References", () => {
    test("parent skill references create.md", () => {
      expect(skill.content).toContain("create.md");
    });
  });

  describe("Create Reference Content", () => {
    test("has substantive content", () => {
      expect(createContent).toBeDefined();
      expect(createContent.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(createContent).toContain("## Quick Reference");
      expect(createContent).toContain("## When to Use This Skill");
      expect(createContent).toContain("## Workflow");
    });

    test("documents sample download workflow", () => {
      expect(createContent).toContain("microsoft-foundry/foundry-samples");
      expect(createContent).toContain("Step 4: Download Sample Files");
    });

    test("supports multiple frameworks", () => {
      expect(createContent).toContain("Agent Framework");
      expect(createContent).toContain("LangGraph");
      expect(createContent).toContain("Custom");
    });

    test("supports multiple languages", () => {
      expect(createContent).toContain("Python");
      expect(createContent).toContain("C#");
    });

    test("contains error handling section", () => {
      expect(createContent).toContain("## Error Handling");
    });

    test("documents greenfield vs brownfield", () => {
      expect(createContent).toContain("Greenfield");
      expect(createContent).toContain("Brownfield");
    });

    test("documents brownfield hosting adapter workflow", () => {
      expect(createContent).toContain("Hosting Adapter");
      expect(createContent).toContain("azure-ai-agentserver");
      expect(createContent).toContain("agent.yaml");
      expect(createContent).toContain("Dockerfile");
    });
  });
});
