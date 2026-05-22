/**
 * Integration Tests — Cost Estimation Depth
 *
 * Validates that AppOnboard provides specific dollar amounts and SKU-level
 * pricing, not just generic mentions of "cost."
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getAllAssistantMessages,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  SKILL_NAME,
  testTimeoutMs,
  assertSessionFileCreated,
  cleanupSessionResourceGroups,
  shouldEarlyTerminateForApprovalGate,
  assertNoSubagentFailures,
  assertQuotaSubagentDispatched,
  assertPricingHandled,
  SUBSCRIPTION_PRIMER,
} from "../app-onboard-test-helpers";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Cost Depth Tests`, () => {
  const _agent = useAgentRunner();
  let lastMetadata: import("../../utils/agent-runner").AgentMetadata | undefined;
  afterEach(() => { if (lastMetadata) { cleanupSessionResourceGroups(lastMetadata); lastMetadata = undefined; } });
  const agent = { run: async (...args: Parameters<typeof _agent.run>) => { const m = await _agent.run(...args); lastMetadata = m; return m; } };

  describe("cost-depth", () => {
    test("cost estimation provides specific pricing — not just mentions cost", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/dev-arv13/demo-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I need to deploy this app to Azure — but first tell me exactly what it will cost",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForApprovalGate,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Hard: must include dollar amounts
        const hasDollarAmounts = /\$\d/.test(messages);
        if (!hasDollarAmounts) {
          agentMetadata.testComments.push("❌ COST DEPTH MISSING: agent did not provide any dollar amounts ($X) in cost estimation");
        }
        expect(hasDollarAmounts).toBe(true);

        // Hard: must mention a specific service or SKU
        const mentionsServiceOrSku = /container apps|app service|static web apps|azure functions|F1|B1|S1|Free|Basic|Standard|tier|sku/i.test(messages);
        if (!mentionsServiceOrSku) {
          agentMetadata.testComments.push("❌ SERVICE/SKU: Did not mention a specific Azure service or SKU code");
        }
        expect(mentionsServiceOrSku).toBe(true);

        // Soft: SKU codes (e.g., "App Service F1 (Free)", "B1 Linux (Basic)")
        const hasSkuCodes = /\b(f1|b1|b2|s1|p1v2|d1)\b/i.test(messages);
        const hasTierNames = /free tier|basic tier|standard tier|\(free\)|\(basic\)|\(standard\)/i.test(messages);
        if (!hasSkuCodes && !hasTierNames) {
          agentMetadata.testComments.push("⚠️ No SKU codes (F1/B1/S1) or tier names found — cost output should include SKU codes and tier names");
        }

        // Hard: per-service breakdown (≥2 dollar amounts + monthly qualifier)
        const dollarMatches = messages.match(/\$\d/g);
        const dollarCount = dollarMatches ? dollarMatches.length : 0;
        const hasMonthlyQualifier = /per month|\/month|monthly/i.test(messages);
        if (dollarCount < 2 || !hasMonthlyQualifier) {
          agentMetadata.testComments.push(`❌ PER-SERVICE BREAKDOWN: ${dollarCount} dollar amounts found (need ≥2), monthly qualifier: ${hasMonthlyQualifier}`);
        }
        expect(dollarCount >= 2 && hasMonthlyQualifier).toBe(true);

        // Soft: total estimate
        const hasTotalEstimate = /total.*\$|estimated.*\$|overall.*\$|\$.*total|\$.*month|per.?month/i.test(messages);
        if (!hasTotalEstimate) {
          agentMetadata.testComments.push("⚠️ No total cost estimate found (expected 'total $X/month' or similar)");
        }

        // Hard: cost assumptions (cost estimate must include assumptions per prepare-phase spec)
        const hasAssumptions = messages.includes("assum");
        if (!hasAssumptions) {
          agentMetadata.testComments.push("❌ COST ASSUMPTIONS: No cost assumptions stated — cost estimate must include assumptions (e.g., 'Assumes ~1 GB/month ingestion')");
        }
        expect(hasAssumptions).toBe(true);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // Sub-agent assertions: quota and pricing must be delegated or handled via MCP
        assertNoSubagentFailures(agentMetadata);
        assertQuotaSubagentDispatched(agentMetadata);
        assertPricingHandled(agentMetadata);

        // Instrumentation/monitoring should be included in cost breakdown
        const hasInstrumentation =
          messages.includes("instrumentation") || messages.includes("app insights") ||
          messages.includes("application insights") || messages.includes("monitoring");
        if (!hasInstrumentation) {
          agentMetadata.testComments.push("⚠️ INSTRUMENTATION: No instrumentation/monitoring mentioned in cost breakdown");
        }
      });
    }, testTimeoutMs);
  });
});
