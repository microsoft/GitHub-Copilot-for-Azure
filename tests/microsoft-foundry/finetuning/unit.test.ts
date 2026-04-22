/**
 * Unit Tests for finetuning sub-skill
 *
 * Test skill content, structure, and validation rules.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSkill, LoadedSkill } from "../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FINETUNING_DIR = path.resolve(
  __dirname,
  "../../../output/skills/microsoft-foundry/finetuning"
);

describe("finetuning - Unit Tests", () => {
  let _skill: LoadedSkill;
  let skillContent: string;

  beforeAll(async () => {
    _skill = await loadSkill(SKILL_NAME);
    skillContent = fs.readFileSync(
      path.join(FINETUNING_DIR, "SKILL.md"),
      "utf-8"
    );
  });

  describe("Skill Structure", () => {
    test("SKILL.md exists in finetuning sub-skill", () => {
      expect(fs.existsSync(path.join(FINETUNING_DIR, "SKILL.md"))).toBe(true);
    });

    test("has references directory", () => {
      expect(
        fs.existsSync(path.join(FINETUNING_DIR, "references"))
      ).toBe(true);
    });

    test("has workflows directory", () => {
      expect(
        fs.existsSync(path.join(FINETUNING_DIR, "workflows"))
      ).toBe(true);
    });

    test("has scripts directory", () => {
      expect(
        fs.existsSync(path.join(FINETUNING_DIR, "scripts"))
      ).toBe(true);
    });
  });

  describe("SKILL.md Content", () => {
    test("has substantive content", () => {
      expect(skillContent.length).toBeGreaterThan(500);
    });

    test("is under token hard limit", () => {
      // ~4 chars per token, 5000 token hard limit
      expect(skillContent.length).toBeLessThan(20000);
    });

    test("contains workflow routing table", () => {
      expect(skillContent).toContain("quickstart");
      expect(skillContent).toContain("full-pipeline");
      expect(skillContent).toContain("dataset-creation");
    });

    test("contains reference routing table", () => {
      expect(skillContent).toContain("training-types");
      expect(skillContent).toContain("grader-design");
      expect(skillContent).toContain("hyperparameters");
    });

    test("contains script references", () => {
      expect(skillContent).toContain("submit_training.py");
      expect(skillContent).toContain("monitor_training.py");
      expect(skillContent).toContain("calibrate_grader.py");
    });

    test("mentions all three training types", () => {
      expect(skillContent).toContain("SFT");
      expect(skillContent).toContain("DPO");
      expect(skillContent).toContain("RFT");
    });

    test("includes rules section", () => {
      expect(skillContent).toContain("baseline");
      expect(skillContent).toContain("Validate");
    });
  });

  describe("Referenced Files Exist", () => {
    const requiredReferences = [
      "training-types.md",
      "hyperparameters.md",
      "dataset-formats.md",
      "grader-design.md",
      "reward-hacking.md",
      "agentic-rft.md",
      "deployment.md",
      "training-curves.md",
      "evaluation.md",
      "vision-fine-tuning.md",
      "large-file-uploads.md",
      "platform-gotchas.md",
    ];

    test.each(requiredReferences)(
      "reference file exists: %s",
      (filename) => {
        const filepath = path.join(FINETUNING_DIR, "references", filename);
        expect(fs.existsSync(filepath)).toBe(true);
      }
    );

    const requiredWorkflows = [
      "quickstart.md",
      "full-pipeline.md",
      "dataset-creation.md",
      "iterative-training.md",
      "diagnose-poor-results.md",
    ];

    test.each(requiredWorkflows)(
      "workflow file exists: %s",
      (filename) => {
        const filepath = path.join(FINETUNING_DIR, "workflows", filename);
        expect(fs.existsSync(filepath)).toBe(true);
      }
    );

    const requiredScripts = [
      "submit_training.py",
      "monitor_training.py",
      "calibrate_grader.py",
      "check_training.py",
      "deploy_model.py",
      "evaluate_model.py",
      "convert_dataset.py",
      "generate_distillation_data.py",
      "score_dataset.py",
      "cleanup.py",
      "common.py",
    ];

    test.each(requiredScripts)(
      "script file exists: %s",
      (filename) => {
        const filepath = path.join(FINETUNING_DIR, "scripts", filename);
        expect(fs.existsSync(filepath)).toBe(true);
      }
    );
  });

  describe("Reference Files Token Limits", () => {
    test("all reference files under 2000 token hard limit", () => {
      const refsDir = path.join(FINETUNING_DIR, "references");
      const files = fs.readdirSync(refsDir).filter((f: string) => f.endsWith(".md"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(refsDir, file), "utf-8");
        const estimatedTokens = Math.ceil(content.length / 4);
        expect(estimatedTokens).toBeLessThan(2000);
      }
    });

    test("all workflow files under 2000 token hard limit", () => {
      const wfDir = path.join(FINETUNING_DIR, "workflows");
      const files = fs.readdirSync(wfDir).filter((f: string) => f.endsWith(".md"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(wfDir, file), "utf-8");
        const estimatedTokens = Math.ceil(content.length / 4);
        expect(estimatedTokens).toBeLessThan(2000);
      }
    });
  });

  describe("Parent Skill References Finetuning", () => {
    test("parent SKILL.md contains finetuning sub-skill entry", () => {
      const parentSkill = fs.readFileSync(
        path.resolve(FINETUNING_DIR, "..", "SKILL.md"),
        "utf-8"
      );
      expect(parentSkill).toContain("finetuning");
      expect(parentSkill).toContain("fine-tun");
    });
  });
});
