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
      expect(datasetsContent).toContain("| MCP server | `azure` |");
      expect(datasetsContent).toContain("## Before Starting");
      expect(datasetsContent).toContain("## The Foundry Flywheel");
      expect(datasetsContent).toContain("## Behavioral Rules");
    });

    test("documents .foundry cache and metadata", () => {
      expect(datasetsContent).toContain(".foundry/agent-metadata.yaml");
      expect(datasetsContent).toContain(".foundry/datasets/");
      expect(datasetsContent).toContain(".foundry/results/");
    });

    test("documents agentName-based versioning and cache reuse", () => {
      expect(datasetsContent).toContain("<agent-name>-eval-seed");
      expect(datasetsContent).toContain("<agent-name>-traces");
      expect(datasetsContent).toContain("<agent-name>-curated");
      expect(datasetsContent).toContain("<agent-name>-prod");
      expect(datasetsContent).toContain(".foundry/datasets/<agent-name>-traces-v<N>.jsonl");
      expect(datasetsContent).toContain(".foundry/datasets/<agent-name>-curated-v<N>.jsonl");
      expect(datasetsContent).toContain(".foundry/datasets/<agent-name>-prod-v<N>.jsonl");
      expect(datasetsContent).toContain("Foundry dataset version");
      expect(datasetsContent).toContain("v<N>");
      expect(datasetsContent).toMatch(/filenames? must start with the selected Foundry agent name/i);
      expect(datasetsContent).toMatch(/do\s+\*\*not\*\*\s+append the environment key a second time/i);
      expect(datasetsContent).toMatch(/cache|refresh/i);
      expect(datasetsContent).toContain("testCases[]");
    });

    test("documents dataset metadata conventions and remote dataset tracking", () => {
      expect(datasetsContent).toContain("agent");
      expect(datasetsContent).toContain("stage");
      expect(datasetsContent).toContain("version");
      expect(datasetsContent).toContain("datasetUri");
      expect(datasetsContent).toContain("AzureStorageAccount");
      expect(datasetsContent).toMatch(/evaluation_dataset_create.*does not expose a first-class `tags` parameter/i);
    });

    test("uses AzureStorageAccount connections and always includes connectionName when registering datasets", () => {
      const traceToDatasetContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "trace-to-dataset.md"),
        "utf-8"
      );
      const seedGuideContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "generate-seed-dataset.md"),
        "utf-8"
      );

      expect(traceToDatasetContent).toContain('category: "AzureStorageAccount"');
      expect(traceToDatasetContent).toContain("connectionName");
      expect(traceToDatasetContent).toContain("evaluation_dataset_create");
      expect(traceToDatasetContent).toMatch(/include it in this workflow so the dataset is bound/i);
      expect(seedGuideContent).toContain("--account-key <storage-account-key>");
      expect(seedGuideContent).toContain("--auth-mode login");
    });

    test("keeps dataset names versionless and stores versions separately in metadata examples", () => {
      const metadataContractContent = fs.readFileSync(
        path.resolve(
          __dirname,
          "../../../../plugin/skills/microsoft-foundry/references/agent-metadata-contract.md"
        ),
        "utf-8"
      );
      const traceToDatasetContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "trace-to-dataset.md"),
        "utf-8"
      );
      const versioningContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "dataset-versioning.md"),
        "utf-8"
      );
      const lineageContent = fs.readFileSync(
        path.join(REFERENCES_PATH, "eval-lineage.md"),
        "utf-8"
      );

      expect(metadataContractContent).toContain("dataset: support-agent-dev-traces");
      expect(metadataContractContent).toContain("datasetVersion: v3");
      expect(metadataContractContent).toContain("dataset: support-agent-prod-curated");
      expect(metadataContractContent).toContain("datasetVersion: v2");
      expect(metadataContractContent).toMatch(/do not append the environment key again/i);
      expect(traceToDatasetContent).toContain('datasetVersion: "v<N>"');
      expect(traceToDatasetContent).toContain('"name": "support-bot-prod-traces"');
      expect(traceToDatasetContent).toContain('"version": "v3"');
      expect(versioningContent).toContain('"name": "support-bot-prod-traces"');
      expect(versioningContent).toContain('"version": "v3"');
      expect(lineageContent).toContain('"name": "support-bot-prod-traces"');
      expect(lineageContent).toContain('"version": "v3"');
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
