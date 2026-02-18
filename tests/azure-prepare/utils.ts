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
 * Paths are normalized to use forward slashes for cross-platform regex matching.
 */
export function listFilesRecursive(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true })
    .map(p => path.join(dir, String(p)).replace(/\\/g, "/"));
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

/**
 * Read azure.yaml and return the docker context for a given service.
 * Uses a simple regex approach to avoid a YAML parsing dependency.
 * Returns undefined if the file doesn't exist, the service isn't found,
 * or the service has no docker.context.
 */
export function getDockerContext(
  workspacePath: string,
  serviceName: string,
): string | undefined {
  const azureYamlPath = path.join(workspacePath, "azure.yaml");
  if (!fs.existsSync(azureYamlPath)) return undefined;

  const content = fs.readFileSync(azureYamlPath, "utf-8");

  // Match the service block and find context: value within its docker: section
  // Looks for: <serviceName>:\n  ...\n    docker:\n      ...\n      context: <value>
  const servicePattern = new RegExp(
    `^[ \\t]*${serviceName}:\\s*$[\\s\\S]*?^[ \\t]+docker:\\s*$[\\s\\S]*?^[ \\t]+context:\\s*(.+)$`,
    "m"
  );
  const match = content.match(servicePattern);
  return match?.[1]?.trim();
}
