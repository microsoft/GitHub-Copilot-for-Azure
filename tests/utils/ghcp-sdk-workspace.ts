/**
 * GHCP SDK Workspace Setup
 *
 * Scaffolds the copilot-sdk-agent AZD template into a test workspace.
 * Used as the starting point for deployment scenarios.
 */

import { execSync } from "child_process";

/**
 * Scaffold the copilot-sdk-agent AZD template into the workspace.
 * Gives the agent a concrete app to customize and deploy.
 */
export async function setupCopilotSdkApp(workspace: string): Promise<void> {
  execSync(`azd init --template jongio/copilot-sdk-agent --no-prompt`, {
    cwd: workspace,
    stdio: "inherit",
  });
}
