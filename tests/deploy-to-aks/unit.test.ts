/**
 * Unit Tests for deploy-to-aks
 *
 * Tests isolated skill logic and validation rules.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "deploy-to-aks";

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
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
    });

    test("description contains trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      const hasTriggerPhrases =
        description.includes("use this") ||
        description.includes("use when") ||
        description.includes("helps") ||
        description.includes("activate") ||
        description.includes("trigger");
      expect(hasTriggerPhrases).toBe(true);
    });

    test("description mentions key AKS concepts", () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/aks|kubernetes/);
      expect(desc).toMatch(/deploy|container|manifest/);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains the standard skill sections", () => {
      expect(skill.content).toContain("## Workflow");
      expect(skill.content).toContain("## Quick Reference");
      expect(skill.content).toContain("## Templates");
      expect(skill.content).toContain("## References");
    });
  });

  describe("Deployment Workflow", () => {
    test("references the quick-deploy phase file", () => {
      expect(skill.content).toMatch(/quick-deploy\.md/i);
    });

    test("lists all 5 workflow phases", () => {
      expect(skill.content).toMatch(/detection/i);
      expect(skill.content).toMatch(/file generation/i);
      expect(skill.content).toMatch(/safeguards validation/i);
      expect(skill.content).toMatch(/deploy/i);
      expect(skill.content).toMatch(/verify/i);
    });
  });

  describe("Deployment Safeguards", () => {
    test("references the safeguards document", () => {
      expect(skill.content).toMatch(/safeguards\.md/i);
    });

    test("covers DS001-DS013 safeguard range", () => {
      expect(skill.content).toMatch(/DS001/i);
      expect(skill.content).toMatch(/DS013/i);
    });
  });

  describe("Templates Coverage", () => {
    test("covers Dockerfile templates", () => {
      expect(skill.content).toMatch(/dockerfile/i);
    });

    test("covers K8s manifest templates", () => {
      expect(skill.content).toMatch(/templates\/k8s/i);
    });

    test("covers GitHub Actions template", () => {
      expect(skill.content).toMatch(/github-actions/i);
    });
  });

  describe("Security Guidance", () => {
    test("references Workload Identity", () => {
      expect(skill.content).toMatch(/workload.?identity/i);
    });

    test("references ACR for container images", () => {
      expect(skill.content).toMatch(/acr|azure container registry/i);
    });
  });

  describe("Knowledge Packs", () => {
    test("references framework knowledge packs", () => {
      expect(skill.content).toMatch(/knowledge.?pack/i);
    });

    test("lists supported frameworks", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/express|django|spring.?boot|fastapi|nextjs/);
    });
  });

  describe("Frontmatter Formatting", () => {
    let frontmatter: string;

    beforeAll(() => {
      const raw = readFileSync(skill.filePath, "utf-8");
      frontmatter = raw.split("---")[1];
    });

    test("frontmatter has no tabs", () => {
      expect(frontmatter).not.toMatch(/\t/);
    });

    test("frontmatter keys are only supported attributes", () => {
      const supported = ["name", "description", "compatibility", "license", "metadata",
        "argument-hint", "disable-model-invocation", "user-invokable"];
      const keys = frontmatter.split("\n")
        .filter((l) => /^[a-z][\w-]*\s*:/.test(l))
        .map((l) => l.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });

    test("WHEN clause is inside description", () => {
      // WHEN: must be embedded in the description string, not parsed as a YAML key
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
    });
  });
});
