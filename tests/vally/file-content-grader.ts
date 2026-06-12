import type { Grader, GraderInput, GraderMetadata, GraderResult } from "@microsoft/vally";

type FileContentRule = {
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

export type FileContentGraderConfig = {
  rules: FileContentRule[];
};

export class FileContentGrader implements Grader {
  metadata: GraderMetadata = {
    name: "file-content",
    description: "Checks whether workspace files satisfy content rules (regex match/not-match with optional comment stripping)",
    behavior: { execution: "single" },
    costProfile: "free",
    portability: "t1-universal",
    reference: "reference-free",
    temporalScope: "trajectory-level",
    determinism: "static"
  };

  async grade(input: GraderInput): Promise<GraderResult> {
    // TODO: Implement file content grading logic
    // 1. Parse and validate config.rules as FileContentRule[]
    // 2. For each rule:
    //    a. Glob for matching files in input.trajectory.workDir
    //    b. Strip comments based on rule.stripComments (xml or java)
    //    c. Optionally narrow content to rule.scope XML element blocks
    //    d. Apply rule.matches (must match in every file)
    //    e. Apply rule["not-matches"] (must not match in any file)
    //    f. Apply rule["any-matches"] (must match in at least one file)
    // 3. Return pass/fail with evidence

    return {
      name: this.metadata.name,
      kind: "code",
      passed: false,
      score: 0,
      evidence: "file-content grader is not yet implemented",
      label: "not-implemented",
      metadata: {},
    };
  }
}
