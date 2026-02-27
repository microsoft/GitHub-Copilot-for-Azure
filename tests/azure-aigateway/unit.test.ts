/**
 * Unit Tests for azure-aigateway
 * 
 * Test isolated skill logic and validation rules.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILL_NAME = "azure-aigateway";
const SKILLS_PATH = path.resolve(__dirname, "../../plugin/skills");
const REFERENCES_PATH = path.join(SKILLS_PATH, "azure-aigateway/references");

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
      expect(skill.metadata.description.length).toBeGreaterThan(150);
    });

    test("description meets minimum length requirement", () => {
      // Descriptions should be > 150 chars for Medium adherence
      expect(skill.metadata.description.length).toBeGreaterThan(150);
    });

    test("description contains USE FOR trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("use for");
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("do not use for");
    });

    test("description routes APIM deployment to azure-prepare", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("deploying apim");
      expect(description).toContain("azure-prepare");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(skill.content).toContain("## When to Use This Skill");
      expect(skill.content).toContain("## Quick Reference");
      expect(skill.content).toContain("## Common Tasks");
      expect(skill.content).toContain("## Troubleshooting");
      expect(skill.content).toContain("## References");
    });

    test("contains AI Gateway governance categories", () => {
      expect(skill.content).toContain("Model Governance");
      expect(skill.content).toContain("Tool Governance");
      expect(skill.content).toContain("Agent Governance");
    });

    test("contains key policy names", () => {
      expect(skill.content).toContain("azure-openai-token-limit");
      expect(skill.content).toContain("azure-openai-semantic-cache-lookup");
      expect(skill.content).toContain("llm-content-safety");
      expect(skill.content).toContain("rate-limit-by-key");
    });

    test("contains MCP tool governance", () => {
      expect(skill.content).toContain("MCP");
      expect(skill.content).toContain("convert API to MCP");
    });

    test("references azure-prepare for APIM deployment", () => {
      expect(skill.content).toContain("azure-prepare");
    });

    test("includes Azure CLI examples", () => {
      expect(skill.content).toContain("az apim show");
      expect(skill.content).toContain("az apim backend");
    });

    test("uses progressive disclosure to reference files", () => {
      expect(skill.content).toContain("references/policies.md");
      expect(skill.content).toContain("references/patterns.md");
      expect(skill.content).toContain("references/troubleshooting.md");
    });
  });

  describe("Reference Files", () => {
    test("policies.md exists and contains policy examples", () => {
      const filePath = path.join(REFERENCES_PATH, "policies.md");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("azure-openai-token-limit");
      expect(content).toContain("azure-openai-semantic-cache");
      expect(content).toContain("llm-content-safety");
      expect(content).toContain("<policies>");
    });

    test("patterns.md exists and contains configuration patterns", () => {
      const filePath = path.join(REFERENCES_PATH, "patterns.md");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("Add AI Model Backend");
      expect(content).toContain("Load Balance");
      expect(content).toContain("az apim backend create");
    });

    test("troubleshooting.md exists and contains common issues", () => {
      const filePath = path.join(REFERENCES_PATH, "troubleshooting.md");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("401");
      expect(content).toContain("429");
      expect(content).toContain("Cognitive Services User");
    });

    test("SDK reference files exist", () => {
      const sdkPath = path.join(REFERENCES_PATH, "sdk");
      expect(fs.existsSync(path.join(sdkPath, "azure-ai-contentsafety-py.md"))).toBe(true);
      expect(fs.existsSync(path.join(sdkPath, "azure-ai-contentsafety-ts.md"))).toBe(true);
      expect(fs.existsSync(path.join(sdkPath, "azure-mgmt-apimanagement-py.md"))).toBe(true);
      expect(fs.existsSync(path.join(sdkPath, "azure-mgmt-apimanagement-dotnet.md"))).toBe(true);
    });
  });

  describe("Cross-Skill References", () => {
    test("azure-prepare has APIM deployment guide", () => {
      const apimPath = path.join(SKILLS_PATH, "azure-prepare/references/apim.md");
      expect(fs.existsSync(apimPath)).toBe(true);
      const content = fs.readFileSync(apimPath, "utf-8");
      expect(content).toContain("APIM Deployment Guide");
      expect(content).toContain("StandardV2");
    });

    test("azure-prepare research.md maps API Management to azure-aigateway", () => {
      const researchPath = path.join(SKILLS_PATH, "azure-prepare/references/research.md");
      expect(fs.existsSync(researchPath)).toBe(true);
      const content = fs.readFileSync(researchPath, "utf-8");
      expect(content).toContain("API Management");
      expect(content).toContain("azure-aigateway");
    });

    test("azure-prepare SKILL.md routes APIM prompts correctly", () => {
      const preparePath = path.join(SKILLS_PATH, "azure-prepare/SKILL.md");
      const content = fs.readFileSync(preparePath, "utf-8");
      expect(content).toContain("APIM");
      expect(content).toContain("apim.md");
    });

    test("azure-deploy SKILL.md references APIM", () => {
      const deployPath = path.join(SKILLS_PATH, "azure-deploy/SKILL.md");
      const content = fs.readFileSync(deployPath, "utf-8");
      expect(content).toContain("APIM");
    });

    test("no cross-skill directory links in reference files", () => {
      // Reference files should not link outside their skill directory
      const patternsContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "patterns.md"), "utf-8"
      );
      const troubleshootingContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "troubleshooting.md"), "utf-8"
      );
      // Should not contain ../../azure-prepare or ../../azure-deploy links
      expect(patternsContent).not.toMatch(/\]\(\.\.\/\.\.\/azure-prepare\//);
      expect(patternsContent).not.toMatch(/\]\(\.\.\/\.\.\/azure-deploy\//);
      expect(troubleshootingContent).not.toMatch(/\]\(\.\.\/\.\.\/azure-prepare\//);
      expect(troubleshootingContent).not.toMatch(/\]\(\.\.\/\.\.\/azure-deploy\//);
    });
  });
});
