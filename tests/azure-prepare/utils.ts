import { type AgentMetadata, getToolCalls } from "../utils/agent-runner";
import * as fs from "fs";
import { listFilesRecursive } from "../utils/evaluate";

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
 * Read azure.yaml and return the docker context for a given service.
 * Uses a simple regex approach to avoid a YAML parsing dependency.
 * Returns undefined if the file doesn't exist, the service isn't found,
 * or the service has no docker.context.
 */
export function getDockerContext(
  workspacePath: string,
  serviceName: string,
): string | undefined {
  const files = listFilesRecursive(workspacePath);
  const azureYamlPath = files.find(f => f.endsWith("/azure.yaml"));
  if (!azureYamlPath) return undefined;

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
