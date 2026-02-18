import { type AgentMetadata, getToolCalls } from "../utils/agent-runner";
import * as fs from "fs";
import * as path from "path";

/**
 * Check if the agent has set the plan status to "Ready for Validation"
 * by editing `.azure/plan.md` via the `edit` tool.
 *
 * Looks for edit tool calls where the arguments contain
 * "Ready for Validation" in `new_str`, targeting a `plan.md` file.
 */
export function hasPlanReadyForValidation(metadata: AgentMetadata): boolean {
  const editCalls = getToolCalls(metadata, "edit");
  return editCalls.some(event => {
    const data = event.data as Record<string, unknown>;
    const args = data.arguments as { path?: string; new_str?: string } | undefined;
    const filePath = args?.path ?? "";
    const newStr = args?.new_str ?? "";
    return filePath.includes("plan.md") && /ready\s+for\s+validation/i.test(newStr);
  });
}

/**
 * Recursively list all files under a directory, returning paths relative to the root.
 */
export function listFilesRecursive(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true })
    .map(p => path.join(dir, String(p)));
}

/**
 * Check if any file in the list matches the given regex pattern.
 */
export function hasFile(files: string[], pattern: RegExp): boolean {
  return files.some(f => pattern.test(f));
}

/**
 * List files in a workspace, log them, and assert expected/unexpected file patterns.
 */
export function expectFiles(
  workspacePath: string,
  expected: RegExp[],
  unexpected: RegExp[],
): void {
  const files = listFilesRecursive(workspacePath);

  for (const pattern of expected) {
    expect(hasFile(files, pattern)).toBe(true);
  }
  for (const pattern of unexpected) {
    expect(hasFile(files, pattern)).toBe(false);
  }
}
