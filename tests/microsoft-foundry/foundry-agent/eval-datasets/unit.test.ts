/**
 * Unit Tests for eval-datasets
 *
 * Test isolated skill logic and validation rules.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATASETS_MD = path.resolve(
  __dirname,
  "../../../../plugin/skills/microsoft-foundry/foundry-agent/eval-datasets/eval-datasets.md"
);
const REFERENCES_PATH = path.resolve(
  __dirname,
  "../../../../plugin/skills/microsoft-foundry/foundry-agent/eval-datasets/references"
);

describe("eval-datasets - Unit Tests", () => {
  let skill: LoadedSkill;
  let datasetsContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    datasetsContent = fs.readFileSync(DATASETS_MD, "utf-8");
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("microsoft-foundry");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });
  });

  describe("Eval-Datasets Content Structure", () => {
    test("has substantive content", () => {
      expect(datasetsContent).toBeDefined();
      expect(datasetsContent.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(datasetsContent).toContain("## Quick Reference");
      expect(datasetsContent).toContain("## Before Starting");
      expect(datasetsContent).toContain("## The Foundry Flywheel");
      expect(datasetsContent).toContain("## Behavioral Rules");
    });

    test("documents .foundry cache and metadata", () => {
      expect(datasetsContent).toContain(".foundry/agent-metadata.yaml");
      expect(datasetsContent).toContain(".foundry/datasets/");
      expect(datasetsContent).toContain(".foundry/results/");
    });

    test("documents environment-aware versioning and cache reuse", () => {
      expect(datasetsContent).toContain("<agent-name>-<environment>-<source>-v<N>");
      expect(datasetsContent).toMatch(/cache|refresh/i);
      expect(datasetsContent).toContain("testCases[]");
    });

    test("documents evalId versus evaluationId guidance", () => {
      const comparisonContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "dataset-comparison.md"),
        "utf-8"
      );
      const trendingContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "eval-trending.md"),
        "utf-8"
      );

      expect(datasetsContent).toContain("evaluationId");
      expect(datasetsContent).toContain("evalId");
      expect(comparisonContent).toMatch(/switch to `evalId`/i);
      expect(trendingContent).toMatch(/evaluation_get expects `evalId`, not `evaluationId`/i);
    });

    test("documents eval group immutability for evaluator and threshold changes", () => {
      const comparisonContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "dataset-comparison.md"),
        "utf-8"
      );
      const trendingContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "eval-trending.md"),
        "utf-8"
      );

      expect(comparisonContent).toMatch(/create a new evaluation group/i);
      expect(comparisonContent).toMatch(/thresholds/i);
      expect(trendingContent).toMatch(/evaluator set and thresholds stayed fixed/i);
    });
  });

  describe("Reference Files Exist", () => {
    const expectedFiles = [
      "trace-to-dataset.md",
      "dataset-versioning.md",
      "dataset-organization.md",
      "dataset-curation.md",
      "eval-trending.md",
      "eval-regression.md",
      "dataset-comparison.md",
      "eval-lineage.md",
    ];

    test.each(expectedFiles)("has reference file: %s", (file) => {
      const filePath = path.join(REFERENCES_PATH, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});
