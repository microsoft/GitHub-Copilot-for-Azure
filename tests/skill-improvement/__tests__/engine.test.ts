import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  changedFiles,
  hasActionableFailureEvidence,
  unlinkDependencyLinks,
  writeCandidatePatch,
  writeFinalCandidatePatch,
} from "../engine.ts";
import type { AggregatedTrial } from "../report.ts";
import { describe, expect, test } from "vitest";

function trial(overrides: Partial<AggregatedTrial> = {}): AggregatedTrial {
  return {
    condition: { name: "Skill only", skill: "enabled", mcp: "disabled" },
    answerModel: "model",
    evalFile: "eval.yaml",
    itemId: "item",
    stimulus: "prompt",
    area: "response-quality",
    passed: true,
    score: 1,
    judgePasses: 1,
    judgeCount: 1,
    judgeDisagreement: false,
    judgments: [],
    output: "answer",
    targetSkillInvoked: true,
    totalTokens: 100,
    ...overrides,
  };
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
      execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["config", "user.name", "Skill Improvement Test"], {
        cwd: root,
      });
      execFileSync("git", ["config", "user.email", "test@example.com"], {
        cwd: root,
      });
      execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
      fs.mkdirSync(path.dirname(skillFile), { recursive: true });
      fs.writeFileSync(skillFile, "baseline\n", "utf8");
      execFileSync("git", ["add", "--all"], { cwd: root });
      execFileSync("git", ["commit", "-m", "baseline"], {
        cwd: root,
        stdio: "ignore",
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

  test("writes an applicable final patch with its trailing newline intact", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-final-patch-"));
    const output = path.join(root, "output");
    const skillFile = path.join(
      root,
      "plugins",
      "azure-skills",
      "skills",
      "azure-kusto",
      "SKILL.md"
    );
    try {
      execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["config", "user.name", "Skill Improvement Test"], {
        cwd: root,
      });
      execFileSync("git", ["config", "user.email", "test@example.com"], {
        cwd: root,
      });
      execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
      fs.mkdirSync(path.dirname(skillFile), { recursive: true });
      fs.writeFileSync(skillFile, "# Skill\n\n## Use Cases\n", "utf8");
      execFileSync("git", ["add", "--all"], { cwd: root });
      execFileSync("git", ["commit", "-m", "baseline"], {
        cwd: root,
        stdio: "ignore",
      });
      const baselineCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();

      fs.writeFileSync(
        skillFile,
        "# Skill\n\nNew guidance.\n\n## Use Cases\n",
        "utf8"
      );
      execFileSync("git", ["add", "--all"], { cwd: root });
      execFileSync("git", ["commit", "-m", "candidate"], {
        cwd: root,
        stdio: "ignore",
      });
      const candidateCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
      fs.mkdirSync(output);

      const patchPath = writeFinalCandidatePatch(
        root,
        output,
        baselineCommit,
        candidateCommit
      );
      const patch = fs.readFileSync(patchPath);

      expect(patch.at(-1)).toBe(10);
      execFileSync("git", ["checkout", "--detach", baselineCommit], {
        cwd: root,
        stdio: "ignore",
      });
      expect(() =>
        execFileSync("git", ["apply", "--check", patchPath], {
          cwd: root,
          stdio: "ignore",
        })
      ).not.toThrow();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("hill-climbing actionability", () => {
  test("stops when no actionable failure evidence remains", () => {
    expect(hasActionableFailureEvidence([trial()], undefined, 15)).toBe(false);
  });

  test.each([
    ["failed trial", [trial({ passed: false })], undefined, {}],
    ["judge disagreement", [trial({ judgeDisagreement: true })], undefined, {}],
    ["low retained skill invocation", [trial({ targetSkillInvoked: false })], 0.8, {}],
    ["low candidate skill invocation", [trial()], 0.8, { candidateSkillInvocationRate: 0 }],
    ["token growth", [trial()], undefined, { skillMarkdownTokenIncreasePercent: 16 }],
    ["validation failure", [trial()], undefined, { hasValidationFailure: true }],
  ] as const)(
    "continues for %s",
    (_name, trials, minimumInvocationRate, gateEvidence) => {
      expect(hasActionableFailureEvidence(
        [...trials],
        minimumInvocationRate,
        15,
        gateEvidence
      )).toBe(true);
    }
  );
});
