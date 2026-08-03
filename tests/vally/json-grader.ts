import * as fs from "node:fs";
import * as path from "node:path";
import type { Grader, GraderInput, GraderMetadata, GraderResult } from "@microsoft/vally";

type JsonGraderRule = {
  /**
   * Checks if the JSON object has a property at given key.
   */
  type: "has-property";

  /**
   * Dot delimited property key path starting from the root.
   * @example "a.b" means there is a top level property "a" whose value is an object and has a nested property "b".
   */
  key: string;

  /**
   * Optional. Required value of the property to check.
   * When specified, the grader will fail if the actual value of the property doesn't equal to the specified value.
   * When not specified, the grader will pass as long as the property exist.
   */
  value?: string | number;
};

type JsonGraderConfig = {
  /**
  * Glob pattern for the json document to look for.
   */
  path: string;

  rules: JsonGraderRule | JsonGraderRule[];
};

function findMatchingPaths(workDir: string, globPattern: string): string[] {
  const matches = new Set<string>();

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (!entry.isDirectory()) {
        const normalizedFullPath = fullPath.replace(/\\/g, "/");

        const relativePath = path.relative(workDir, fullPath).replace(/\\/g, "/");

        if (path.matchesGlob(relativePath, globPattern) || path.matchesGlob(normalizedFullPath, globPattern)) {
          matches.add(path.resolve(fullPath));
        }
      } else {
        walk(fullPath);
      }
    }
  }

  walk(workDir);
  return Array.from(matches).sort((a, b) => a.localeCompare(b));
}

function hasProperty(value: unknown, keyPath: string, expectedValue?: string | number): boolean {
  const keys = keyPath.split(".");
  let current: unknown = value;

  for (const key of keys) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[key];
  }

  if (expectedValue === undefined) {
    return true;
  }

  return current === expectedValue;
}

export class JsonGrader implements Grader {
  metadata: GraderMetadata = {
    name: "json-object-rules",
    description: "Checks whether a JSON file satisfies the given rules",
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

    const rawPath = input.config.path;
    const rawRules = input.config.rules;

    if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
      throw new Error(`Invalid ${this.metadata.name} grader config. path is not a string`);
    }
    if (rawRules === undefined || rawRules === null) {
      throw new Error(`Invalid ${this.metadata.name} grader config. rules is not a JSON string.`);
    }

    const workDir = input.trajectory.workDir;
    const config = {
      path: rawPath,
      rules: typeof rawRules === "string" ? JSON.parse(rawRules) : rawRules,
    } as JsonGraderConfig;

    const globPattern = config.path.replace(/\\/g, "/");
    try {
      // Validate glob syntax up front.
      path.matchesGlob("", globPattern);
    } catch {
      throw new Error(`Invalid ${this.metadata.name} grader config. path is not a valid glob pattern`);
    }

    const matchedPaths = findMatchingPaths(workDir, globPattern);

    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const hasExactSingleMatch = matchedPaths.length === 1;
    let passed = false;
    let evidence!: string;

    if (!hasExactSingleMatch) {
      evidence = `Expected exactly one match, but found ${matchedPaths.length} candidate path(s).`;
    } else {
      const [matchedPath] = matchedPaths;
      const content = fs.readFileSync(matchedPath, "utf8");
      const parsed = JSON.parse(content) as unknown;

      passed = true;

      for (const rule of rules) {
        if (rule.type !== "has-property") {
          passed = false;
          break;
        }

        passed = hasProperty(parsed, rule.key, rule.value);
        if (!passed) {
          break;
        }
      }

      evidence = passed
        ? "Exactly one matching path was found and the JSON rules passed."
        : "The unique matching file was found, but it did not satisfy the configured JSON rules.";
    }

    return {
      name: this.metadata.name,
      kind: "code",
      passed,
      score: passed ? 1 : 0,
      evidence,
      label: passed ? "correct" : "incorrect",
      metadata: {
        matchedPaths,
        pattern: globPattern
      },
    };
  }
}
