import * as fs from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "airunway-aks-setup";

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
    });

    test("description is concise and actionable", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(1000);
    });

    test("description mentions AI Runway and AKS", () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/ai runway|airunway/);
      expect(desc).toMatch(/aks|cluster/);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });
  });

  describe("Frontmatter Formatting", () => {
    test("frontmatter has no tabs", () => {
      const raw = fs.readFileSync(skill.filePath, "utf-8");
      // Extract content between the opening and closing --- delimiters
      const frontmatterMatch = raw.match(/^-{3}\n([\s\S]*?)\n-{3}/);
      const frontmatter = frontmatterMatch ? frontmatterMatch[1] : "";
      // Fail loudly if frontmatter extraction failed — prevents silent vacuous pass
      expect(frontmatter.length).toBeGreaterThan(0);
      expect(frontmatter).not.toMatch(/\t/);
    });

    test("frontmatter keys are only supported attributes", () => {
      const supported = ["name", "description", "compatibility", "license", "metadata",
        "argument-hint", "disable-model-invocation", "user-invokable"];
      // Use parsed metadata keys rather than re-parsing the raw YAML
      const metadataKeys = Object.keys(skill.metadata);
      for (const key of metadataKeys) {
        expect(supported).toContain(key);
      }
    });

    test("WHEN clause is inside description", () => {
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
    });
  });

  describe("Required Section Structure", () => {
    test("contains the standard skill sections", () => {
      expect(skill.content).toContain("## Quick Reference");
      expect(skill.content).toContain("## Prerequisites");
      expect(skill.content).toContain("## Rules");
      expect(skill.content).toContain("## Steps");
      expect(skill.content).toContain("## Error Handling");
    });
  });

  describe("Six-Phase Workflow", () => {
    test("covers all six setup phases", () => {
      expect(skill.content).toMatch(/Cluster Verification/i);
      expect(skill.content).toMatch(/Controller Installation/i);
      expect(skill.content).toMatch(/GPU Assessment/i);
      expect(skill.content).toMatch(/Provider Setup/i);
      expect(skill.content).toMatch(/First Deployment/i);
      expect(skill.content).toMatch(/Summary/i);
    });

    test("references step detail files", () => {
      expect(skill.content).toMatch(/step-1-verify\.md/i);
      expect(skill.content).toMatch(/step-2-controller\.md/i);
      expect(skill.content).toMatch(/step-3-gpu\.md/i);
      expect(skill.content).toMatch(/step-4-provider\.md/i);
      expect(skill.content).toMatch(/step-5-deploy\.md/i);
      expect(skill.content).toMatch(/step-6-summary\.md/i);
    });
  });

  describe("Quick Reference Section", () => {
    test("lists kubectl as a CLI tool", () => {
      expect(skill.content).toMatch(/kubectl/);
    });

    test("lists make as a CLI tool", () => {
      expect(skill.content).toMatch(/make/i);
    });

    test("lists curl as a CLI tool", () => {
      expect(skill.content).toMatch(/curl/i);
    });
  });

  describe("Troubleshooting Reference", () => {
    test("links to troubleshooting reference", () => {
      expect(skill.content).toMatch(/troubleshooting\.md/i);
    });
  });
});
