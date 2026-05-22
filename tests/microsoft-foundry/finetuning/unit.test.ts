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
  let parentSkill: LoadedSkill;
  let skillContent: string;

  beforeAll(async () => {
    parentSkill = await loadSkill(SKILL_NAME);
    skillContent = fs.readFileSync(
      path.join(FINETUNING_DIR, "SKILL.md"),
      "utf-8"
    );
  });

  describe("Skill Structure", () => {
    test("parent skill loads successfully", () => {
      expect(parentSkill).toBeDefined();
    });

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
      const parentSkillContent = fs.readFileSync(
        path.resolve(FINETUNING_DIR, "..", "SKILL.md"),
        "utf-8"
      );
      expect(parentSkillContent).toContain("finetuning");
      expect(parentSkillContent).toContain("fine-tun");
    });
  });

  describe("Python Script Quality", () => {
    const scriptsDir = path.join(FINETUNING_DIR, "scripts");

    test("all Python scripts have encoding on text-mode open() calls", () => {
      const getAllPyFiles = (dir: string): string[] => {
        const results: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push(...getAllPyFiles(full));
          } else if (entry.name.endsWith(".py")) {
            results.push(full);
          }
        }
        return results;
      };

      const pyFiles = getAllPyFiles(scriptsDir);
      const issues: string[] = [];
      for (const filepath of pyFiles) {
        const content = fs.readFileSync(filepath, "utf-8");
        const filename = path.relative(scriptsDir, filepath);
        const lines = content.split("\n");
        lines.forEach((line: string, i: number) => {
          if (
            line.includes("open(") &&
            !line.includes("encoding") &&
            !line.includes('"rb"') &&
            !line.includes('"wb"') &&
            !line.includes("purpose=") &&
            !line.trim().startsWith("#")
          ) {
            issues.push(`${filename}:${i + 1}: ${line.trim()}`);
          }
        });
      }
      expect(issues).toEqual([]);
    });

    test("all scripts use common.get_clients() not custom client creation", () => {
      const pyFiles = fs.readdirSync(scriptsDir)
        .filter((f: string) => f.endsWith(".py") && f !== "common.py");

      const issues: string[] = [];
      for (const file of pyFiles) {
        const content = fs.readFileSync(path.join(scriptsDir, file), "utf-8");
        // Check for custom client creation patterns that should use common.py
        if (
          content.includes("openai.AzureOpenAI(") ||
          content.includes("openai.OpenAI(") ||
          /def get_client\(/.test(content)
        ) {
          issues.push(`${file}: contains custom client creation (should use common.get_clients())`);
        }
      }
      expect(issues).toEqual([]);
    });

    test("no bare resp.json() in error handling paths (JSONDecodeError risk)", () => {
      const getAllPyFiles = (dir: string): string[] => {
        const results: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push(...getAllPyFiles(full));
          } else if (entry.name.endsWith(".py")) {
            results.push(full);
          }
        }
        return results;
      };

      const pyFiles = getAllPyFiles(scriptsDir);
      const issues: string[] = [];
      for (const filepath of pyFiles) {
        const content = fs.readFileSync(filepath, "utf-8");
        const filename = path.relative(scriptsDir, filepath);
        const lines = content.split("\n");
        lines.forEach((line: string, i: number) => {
          // Flag resp.json().get() in error paths (print/raise after failed status check)
          // Safe patterns: wrapped in try/except (same line or preceding 3 lines), or using _safe_error_msg()
          if (
            line.includes("resp.json().get(") &&
            !line.trim().startsWith("#") &&
            !line.includes("try:") &&
            !line.includes("_safe_error_msg")
          ) {
            // Check preceding 3 lines for a try: block
            const precedingLines = lines.slice(Math.max(0, i - 3), i);
            const inTryBlock = precedingLines.some((pl: string) => pl.trim().startsWith("try:"));
            if (!inTryBlock) {
              issues.push(`${filename}:${i + 1}: bare resp.json() may raise JSONDecodeError on non-JSON responses — use try/except or _safe_error_msg()`);
            }
          }
        });
      }
      expect(issues).toEqual([]);
    });

    test("SKILL.md script table matches actual script files", () => {
      const skillContent = fs.readFileSync(
        path.join(FINETUNING_DIR, "SKILL.md"),
        "utf-8"
      );
      // Extract script names from SKILL.md table
      const scriptRefs = skillContent.match(/`scripts\/[\w/.]+\.py`/g) || [];
      for (const ref of scriptRefs) {
        const scriptPath = ref.replace(/`/g, "");
        const fullPath = path.join(FINETUNING_DIR, scriptPath);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    });
  });
});
