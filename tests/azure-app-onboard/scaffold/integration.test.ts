/**
 * Integration Tests for azure-app-onboard/scaffold subskill
 *
 * Tests scaffold-phase behaviors:
 * - Bicep generation for a simple app (broken-todo-demo)
 * - Sub-agent delegation for IaC generation
 * - Secure defaults (managed identity, RBAC, Key Vault)
 * - No deploy without approval
 *
 * Removed (consolidated elsewhere):
 * - scaffold-delegation routing → redundant with integration-invocation
 * - scaffold refuses existing IaC (microblog) → moved to scaffold/integration-existing-iac
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  doesAssistantOrToolsIncludeKeyword,
  withTestResult,
  getAllAssistantMessages,
  getToolCalls,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  testTimeoutMs,
  assertScaffoldSubagentsDispatched,
  assertNoSubagentFailures,
  hasReachedScaffoldPhase,
  SUBSCRIPTION_PRIMER,
} from "../app-onboard-test-helpers";

const SKILL_NAME = "azure-app-onboard";

/**
 * Stricter early terminator that only fires on ACTUAL IaC file writes (tool calls),
 * not text mentions.
 */
function shouldEarlyTerminateOnIaCFileWrite(agentMetadata: import("../../utils/agent-runner").AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const toolCalls = getToolCalls(agentMetadata);

  // Check 1: Direct IaC file write in parent context
  const hasIaCWriteToolCall = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    const isWriteTool = toolName === "create_file" || toolName === "write_file" || toolName === "create";
    if (!isWriteTool) return false;
    const argsObj = tc.data.arguments as Record<string, unknown> | undefined;
    const filePath = ((argsObj?.path ?? argsObj?.filePath ?? "") as string).toLowerCase();
    return (filePath.endsWith(".bicep") || filePath.endsWith(".tf")) && filePath.includes("infra/");
  });

  // Check 2: Sub-agent completed IaC generation/review (files written inside sub-agent are invisible to Check 1)
  const hasSubagentIaCComplete = toolCalls.some(tc => {
    const tn = (tc.data.toolName ?? "").toLowerCase();
    if (tn !== "read_agent") return false;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("iac") || args.includes("review") || args.includes("scaffold");
  });

  // Check 3: scaffold-manifest.json written (canonical scaffold completion signal)
  const hasManifest = toolCalls.some(tc => {
    const tn = (tc.data.toolName ?? "").toLowerCase();
    if (tn !== "create" && tn !== "create_file" && tn !== "edit") return false;
    const filePath = ((tc.data.arguments as Record<string, unknown>)?.path as string ?? "").toLowerCase();
    return filePath.includes("scaffold-manifest.json");
  });

  return hasIaCWriteToolCall || hasSubagentIaCComplete || hasManifest;
}

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_scaffold - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("scaffold-generation", () => {
    test("scaffold generates Bicep for simple app", async () => {
      await withTestResult(async () => {
        // broken-todo-demo: Express 5.x, no existing IaC, proven ✅ in manual runs
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/Arun07AK/broken-todo-demo", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I built a side project and want to get it live on Azure",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnIaCFileWrite,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        // Scaffold-specific: IaC content present (Bicep or Terraform)
        const hasIaCContent =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "main.bicep") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "bicep") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "infra/");
        if (!hasIaCContent) {
          agentMetadata.testComments.push("⚠️ SCAFFOLD: No Bicep/IaC file names in output — agent may not have reached scaffold phase");
        }

        // Sub-agent assertions: scaffold MUST delegate IaC generation
        if (hasReachedScaffoldPhase(agentMetadata)) {
          assertScaffoldSubagentsDispatched(agentMetadata);
        } else {
          agentMetadata.testComments.push("⚠️ SCAFFOLD PHASE NOT REACHED: Skipping sub-agent delegation assertion");
        }
        assertNoSubagentFailures(agentMetadata);

        // Secure defaults: managed identity, RBAC, or Key Vault mentioned
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const hasSecureDefaults =
          messages.includes("managed identity") || messages.includes("managed-identity") ||
          messages.includes("key vault") || messages.includes("keyvault") ||
          messages.includes("rbac") || messages.includes("least privilege");
        if (!hasSecureDefaults) {
          agentMetadata.testComments.push("⚠️ SCAFFOLD: No secure defaults (managed identity/RBAC/Key Vault) mentioned");
        }

        // Must NOT deploy without approval
        const toolCalls = getToolCalls(agentMetadata);
        const shellToolNames = ["powershell", "shell", "run_command", "bash", "terminal"];
        const hasDeployCmd = toolCalls.some(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          if (!shellToolNames.some(s => toolName.includes(s))) return false;
          const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
          // Exclude heredocs, echo/Write-Host that mention deploy commands as text
          const isEchoOrHeredoc = /^@"|^write-host|^echo /i.test(cmd.trim());
          if (isEchoOrHeredoc) return false;
          return cmd.includes("azd up") || cmd.includes("azd provision") ||
            cmd.includes("az deployment") || cmd.includes("terraform apply");
        });
        // Soft: deploy violation is a secondary concern — early terminator fires on IaC write
        // but the agent may auto-proceed past deploy gate with non-interactive follow-ups.
        // Deploy safety is hard-asserted in deploy/ integration tests.
        if (hasDeployCmd) {
          agentMetadata.testComments.push("⚠️ SCAFFOLD VIOLATION: Agent executed deploy commands without approval (non-blocking — deploy tests cover this)");
        }
      });
    }, testTimeoutMs);
  });
});
