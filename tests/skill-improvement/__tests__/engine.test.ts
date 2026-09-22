import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  changedFiles,
  collectCandidateChanges,
  unlinkDependencyLinks,
  writeCandidatePatch,
} from "../engine.ts";
import type { SkillImprovementRunSpec } from "../config.ts";
import { describe, expect, test } from "vitest";

function spec(): SkillImprovementRunSpec {
  return {
    name: "test",
    target: {
      plugin: "azure-skills",
      skill: "azure-kusto",
      baselineRef: "HEAD",
    },
    evaluations: {
      root: "tests/skill-improvement/evals/azure-kusto",
      development: ["quality.eval.yaml"],
    },
    models: {
      answers: ["answer"],
      judges: ["judge"],
    },
    experiment: {
      repetitions: 1,
      conditions: [
        { name: "Skill only", skill: "enabled", mcp: "disabled" },
      ],
    },
    improvementAgent: {
      enabled: true,
      model: "agent",
    },
    acceptance: {
      minimumQualityImprovementPoints: 1,
      maximumEvalRegressionPoints: 1,
      maximumModelRegressionPoints: 1,
    },
    limits: {
      maxIterations: 1,
      maxAnswerGenerations: 1,
      maxJudgeCalls: 1,
      maxDurationMinutes: 1,
      maxConcurrentJobs: 1,
      maxSkillTokenIncreasePercent: 1,
    },
    output: {
      issue: "never",
      draftPullRequest: "never",
    },
  };
}

function initializeRepository(root: string, files: Record<string, string>): void {
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Skill Improvement Test"], {
    cwd: root,
  });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: root,
  });
  execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
  }
  execFileSync("git", ["add", "--all"], { cwd: root });
  execFileSync("git", ["commit", "-m", "baseline"], {
    cwd: root,
    stdio: "ignore",
  });
}

describe("worktree dependency cleanup", () => {
  test("unlinks dependency junctions without deleting their targets", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-links-"));
    const source = path.join(root, "source");
    const worktree = path.join(root, "worktree");
    const link = path.join(worktree, "node_modules");
    fs.mkdirSync(source);
    fs.mkdirSync(worktree);
    fs.writeFileSync(path.join(source, "marker.txt"), "keep", "utf8");
    fs.symlinkSync(source, link, process.platform === "win32" ? "junction" : "dir");

    unlinkDependencyLinks(worktree);

    expect(fs.existsSync(link)).toBe(false);
    expect(fs.readFileSync(path.join(source, "marker.txt"), "utf8")).toBe("keep");
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("excludes runner dependency links from candidate changes and patches", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-git-"));
    const dependencySource = fs.mkdtempSync(
      path.join(os.tmpdir(), "skill-improvement-dependencies-")
    );
    const skillFile = path.join(
      root,
      "plugins",
      "azure-skills",
      "skills",
      "azure-kusto",
      "SKILL.md"
    );
    const dependencyLink = path.join(root, "node_modules");
    const iterationDirectory = path.join(root, "iteration-output");
    try {
      initializeRepository(root, {
        "plugins/azure-skills/skills/azure-kusto/SKILL.md": "baseline\n",
      });

      fs.writeFileSync(path.join(dependencySource, "marker.txt"), "dependency", "utf8");
      fs.symlinkSync(
        dependencySource,
        dependencyLink,
        process.platform === "win32" ? "junction" : "dir"
      );
      fs.writeFileSync(skillFile, "candidate\n", "utf8");
      fs.mkdirSync(iterationDirectory);

      expect(changedFiles(root)).toEqual([
        "plugins/azure-skills/skills/azure-kusto/SKILL.md",
      ]);
      const patch = fs.readFileSync(
        writeCandidatePatch(root, iterationDirectory),
        "utf8"
      );
      expect(patch).toContain("plugins/azure-skills/skills/azure-kusto/SKILL.md");
      expect(patch).not.toContain("node_modules");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(dependencySource, { recursive: true, force: true });
    }
  });
});

describe("candidate path validation", () => {
  test("restores out-of-scope CRLF-to-LF noise before creating the candidate patch", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-eol-"));
    const skillFile = path.join(
      root,
      "plugins",
      "azure-skills",
      "skills",
      "azure-kusto",
      "SKILL.md"
    );
    const unrelatedFile = path.join(root, "tests", "foundry-iq", "fixture.json");
    const iterationDirectory = path.join(root, "iteration-output");
    try {
      initializeRepository(root, {
        "plugins/azure-skills/skills/azure-kusto/SKILL.md": "baseline\n",
        "tests/foundry-iq/fixture.json": "{\r\n  \"value\": true\r\n}\r\n",
      });
      fs.writeFileSync(skillFile, "candidate\n", "utf8");
      fs.writeFileSync(unrelatedFile, "{\n  \"value\": true\n}\n", "utf8");
      fs.mkdirSync(iterationDirectory);

      const result = collectCandidateChanges(root, spec());

      expect(result).toEqual({
        changedFiles: ["plugins/azure-skills/skills/azure-kusto/SKILL.md"],
        validationErrors: [],
      });
      expect(fs.readFileSync(unrelatedFile, "utf8")).toBe(
        "{\r\n  \"value\": true\r\n}\r\n"
      );
      const patch = fs.readFileSync(
        writeCandidatePatch(root, iterationDirectory),
        "utf8"
      );
      expect(patch).toContain("plugins/azure-skills/skills/azure-kusto/SKILL.md");
      expect(patch).not.toContain("tests/foundry-iq/fixture.json");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("keeps and rejects semantic out-of-scope changes", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-paths-"));
    const unrelatedFile = path.join(root, "tests", "foundry-iq", "fixture.json");
    try {
      initializeRepository(root, {
        "plugins/azure-skills/skills/azure-kusto/SKILL.md": "baseline\n",
        "tests/foundry-iq/fixture.json": "{\r\n  \"value\": true\r\n}\r\n",
      });
      fs.writeFileSync(unrelatedFile, "{\n  \"value\": false\n}\n", "utf8");

      expect(collectCandidateChanges(root, spec())).toEqual({
        changedFiles: ["tests/foundry-iq/fixture.json"],
        validationErrors: [
          "Change outside allowed paths: tests/foundry-iq/fixture.json",
        ],
      });
      expect(fs.readFileSync(unrelatedFile, "utf8")).toBe(
        "{\n  \"value\": false\n}\n"
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
