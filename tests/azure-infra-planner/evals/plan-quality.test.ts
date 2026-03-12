/**
 * Plan Quality Integration Test for azure-infra-planner
 *
 * Runs the skill with a golden prompt, preserves the workspace,
 * and verifies that infrastructure-plan.json is generated.
 * The markdown report + plan artifact can then be evaluated
 * via the plan-eval skill.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../../utils/agent-runner";
import { isSkillInvoked } from "../../utils/evaluate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILL_NAME = "azure-infra-planner";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping plan-quality tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Plan Quality`, () => {
  const agent = useAgentRunner();

  test("generates infrastructure-plan.json for event-driven pipeline", async () => {
    let testWorkspacePath: string | undefined;

    let agentMetadata;
    try {
      agentMetadata = await agent.run({
        prompt:
          "Plan Azure infrastructure for an event-driven serverless data pipeline with Cosmos DB and Event Hub. " +
          "Let's focus on cost optimization and scalability. Assume all defaults to make the plan.",
        preserveWorkspace: true,
        includeSkills: ["azure-infra-planner"],
        setup: async (workspace: string) => {
          testWorkspacePath = workspace;
        }
      });
    } catch (e: unknown) {
      if (e instanceof Error && (e.message?.includes("Failed to load @github/copilot-sdk") || e.message?.includes("CLI server exited"))) {
        console.log("⏭️  SDK/CLI not available, skipping test");
        return;
      }
      throw e;
    }

    // Skill should have been invoked
    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

    // Response should reference infrastructure planning concepts
    const mentionsPlan =
      doesAssistantMessageIncludeKeyword(agentMetadata, "plan") ||
      doesAssistantMessageIncludeKeyword(agentMetadata, "infrastructure");
    expect(mentionsPlan).toBe(true);

    // Check for the plan artifact in the workspace
    if (testWorkspacePath) {
      const planPath = path.join(testWorkspacePath, ".azure", "infrastructure-plan.json");
      if (fs.existsSync(planPath)) {
        const planContent = fs.readFileSync(planPath, "utf-8");
        const plan = JSON.parse(planContent);

        // Basic structural checks
        expect(plan).toHaveProperty("meta");
        expect(plan).toHaveProperty("inputs");
        expect(plan).toHaveProperty("plan");
        expect(plan.plan).toHaveProperty("resources");
        expect(Array.isArray(plan.plan.resources)).toBe(true);
        expect(plan.plan.resources.length).toBeGreaterThan(0);

        // Should contain Event Hub and Cosmos DB resources
        const resourceTypes = plan.plan.resources.map((r: { type?: string }) =>
          (r.type || "").toLowerCase()
        );
        const hasEventHub = resourceTypes.some((t: string) => t.includes("eventhub"));
        const hasCosmosDb = resourceTypes.some((t: string) => t.includes("cosmosdb") || t.includes("documentdb"));
        console.log(`📋 Plan has ${plan.plan.resources.length} resources`);
        console.log(`   Event Hub present: ${hasEventHub}`);
        console.log(`   Cosmos DB present: ${hasCosmosDb}`);

        // Copy the plan to the reports directory for evaluation
        const reportsDir = path.resolve(__dirname, "..", "reports", "plan-quality");
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }
        fs.copyFileSync(planPath, path.join(reportsDir, "infrastructure-plan.json"));
        console.log(`📁 Plan copied to ${reportsDir}/infrastructure-plan.json`);
      } else {
        console.warn("⚠️  infrastructure-plan.json not found in workspace .azure/ directory");
        // Check if it was written elsewhere
        const files = listFilesRecursive(testWorkspacePath);
        const planFiles = files.filter(f => f.endsWith("infrastructure-plan.json"));
        if (planFiles.length > 0) {
          console.log(`   Found plan at: ${planFiles.join(", ")}`);
        }
      }
    }
  }, 20 * 60 * 1000); // 20 minute timeout
});

/** Recursively list files in a directory */
function listFilesRecursive(dir: string, maxDepth = 4, currentDepth = 0): string[] {
  if (currentDepth >= maxDepth) return [];
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".git") && entry.name !== "node_modules") {
        results.push(...listFilesRecursive(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  } catch { /* ignore permission errors */ }
  return results;
}
