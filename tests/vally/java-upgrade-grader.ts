import * as fs from "node:fs";
import * as path from "node:path";
import type { Grader, GraderInput, GraderMetadata, GraderResult } from "@microsoft/vally";

type JavaUpgradeFileContentRule = {
  /**
   * Glob pattern for files to check (relative to workspace root).
   * @example "pom.xml" or "**\/*.java"
   */
  glob: string;

  /**
   * Comment style to strip before applying regex assertions.
   * - "xml": strips <!-- ... --> comments
   * - "java": strips // line comments and /* ... * / block comments
   * - undefined: no stripping
   */
  stripComments?: "xml" | "java";

  /**
   * Optional scope to narrow assertions to specific XML elements.
   * E.g. "dependency" restricts matching to <dependency>...</dependency> blocks.
   */
  scope?: string;

  /**
   * Regex pattern that must match in every matched file's content.
   */
  matches?: string;

  /**
   * Regex pattern that must NOT match in any matched file's content.
   */
  "not-matches"?: string;

  /**
   * Regex pattern that must match in at least one matched file's content.
   */
  "any-matches"?: string;
};

export type JavaUpgradeFileContentGraderConfig = {
  rules: JavaUpgradeFileContentRule[];
};

const SKIP_DIRS = new Set(["target", ".git", "node_modules", ".class"]);

function findMatchingFiles(workDir: string, globPattern: string): string[] {
  const matches: string[] = [];
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(workDir, fullPath).replace(/\\/g, "/");
        if (path.matchesGlob(relativePath, globPattern)) {
          matches.push(fullPath);
        }
      }
    }
  }
  walk(workDir);
  return matches.sort((a, b) => a.localeCompare(b));
}

function stripXmlComments(content: string): string {
  return content.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
}

function stripJavaComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

function stripComments(content: string, style: "xml" | "java" | undefined): string {
  if (style === "xml") return stripXmlComments(content);
  if (style === "java") return stripJavaComments(content);
  return content;
}

/**
 * Extract all blocks matching `<tag ...>...</tag>` from the content.
 * Returns the concatenation of all matching blocks.
 */
function extractScopedBlocks(content: string, scope: string): string {
  const pattern = new RegExp(`<${scope}\\b[\\s\\S]*?<\\/${scope}>`, "g");
  const blocks = content.match(pattern);
  return blocks ? blocks.join("\n") : "";
}

function parseRules(raw: unknown): JavaUpgradeFileContentRule[] {
  if (Array.isArray(raw)) return raw as JavaUpgradeFileContentRule[];
  if (typeof raw === "string") return JSON.parse(raw) as JavaUpgradeFileContentRule[];
  throw new Error("rules must be an array or a JSON string");
}

export class JavaUpgradeFileContentGrader implements Grader {
  metadata: GraderMetadata = {
    name: "java-upgrade-file-content",
    description: "Checks whether workspace files satisfy content rules (regex match/not-match with optional comment stripping)",
    behavior: { requiresLlmClient: false, requiresWorkspace: true },
    costProfile: "free",
    reference: "reference-free",
    temporalScope: "trajectory-level",
    determinism: "static"
  };

  async grade(input: GraderInput): Promise<GraderResult> {
    if (!input.trajectory) {
      throw new Error("Missing trajectory");
    }
    if (!input.config || typeof input.config !== "object") {
      throw new Error(`Invalid ${this.metadata.name} grader config`);
    }

    const workDir = input.trajectory.workDir;
    const rules = parseRules(input.config.rules);
    if (rules.length === 0) {
      throw new Error(`${this.metadata.name}: rules array is empty`);
    }

    const failures: string[] = [];

    for (const rule of rules) {
      const globPattern = rule.glob.replace(/\\/g, "/");
      try {
        path.matchesGlob("", globPattern);
      } catch {
        failures.push(`glob "${rule.glob}": invalid glob pattern`);
        continue;
      }
      const files = findMatchingFiles(workDir, globPattern);
      if (files.length === 0) {
        failures.push(`glob "${rule.glob}": no matching files found`);
        continue;
      }

      // Prepare file contents: strip comments, apply scope
      const fileContents = files.map(f => {
        let content = fs.readFileSync(f, "utf8");
        content = stripComments(content, rule.stripComments);
        if (rule.scope) {
          content = extractScopedBlocks(content, rule.scope);
        }
        return { path: path.relative(workDir, f), content };
      });

      // matches: pattern must match in EVERY file
      if (rule.matches) {
        const pattern = new RegExp(rule.matches);
        for (const { path: filePath, content } of fileContents) {
          if (!pattern.test(content)) {
            failures.push(`glob "${rule.glob}", file "${filePath}": expected to match /${rule.matches}/ but did not`);
          }
        }
      }

      // not-matches: pattern must NOT match in ANY file
      if (rule["not-matches"]) {
        const pattern = new RegExp(rule["not-matches"]);
        for (const { path: filePath, content } of fileContents) {
          if (pattern.test(content)) {
            failures.push(`glob "${rule.glob}", file "${filePath}": expected NOT to match /${rule["not-matches"]}/ but it did`);
          }
        }
      }

      // any-matches: pattern must match in AT LEAST ONE file
      if (rule["any-matches"]) {
        const pattern = new RegExp(rule["any-matches"]);
        const anyMatch = fileContents.some(({ content }) => pattern.test(content));
        if (!anyMatch) {
          failures.push(`glob "${rule.glob}": expected at least one file to match /${rule["any-matches"]}/ but none did`);
        }
      }
    }

    const passed = failures.length === 0;
    const evidence = passed
      ? `All ${rules.length} file content rule(s) passed.`
      : `${failures.length} failure(s):\n${failures.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}`;

    return {
      name: this.metadata.name,
      kind: "code",
      passed,
      score: passed ? 1 : 0,
      evidence,
      label: passed ? "correct" : "incorrect",
      metadata: { ruleCount: rules.length, failureCount: failures.length },
    };
  }
}
