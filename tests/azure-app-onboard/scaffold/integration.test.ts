/**
 * Integration Tests for azure-app-onboard/scaffold subskill
 *
 * Routes prompts through the PARENT skill (azure-app-onboard) and verifies
 * that the parent delegates to the scaffold subskill — evidenced by
 * scaffold-domain outputs (IaC generation, self-review, manifest writing).
 *
 * Prompts are golden (from prompts.json) with followUp to push the
 * conversation past prepare/approval into scaffold territory.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 3. az login + azd auth login
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  shouldEarlyTerminateForSkillInvocation,
  doesAssistantOrToolsIncludeKeyword,
  withTestResult,
  getAllAssistantMessages,
  getToolCalls,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import type { AgentMetadata } from "../../utils/agent-runner";
import { testTimeoutMs } from "../app-onboard-test-helpers";

const SKILL_NAME = "azure-app-onboard"; // Route to parent — parent delegates to scaffold
const RUNS_PER_PROMPT = 1;
const invocationRateThreshold = 0.8;

/**
 * Early terminate once the agent produces IaC generation or scaffold-manifest signals
 * (evidence that the scaffold subskill ran).
 * Fires on IaC generation OR scaffold-specific signals (not AND) — the agent
 * may produce IaC without explicitly mentioning self-review in assistant messages.
 */
function shouldEarlyTerminateForScaffoldOutput(agentMetadata: AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    // Bail if we've had enough tool calls without skill invocation — routing failed
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

  // Scaffold subskill signal 1: IaC file generation (text mentions)
  const hasIaCGeneration =
    (messages.includes("main.tf") || messages.includes("main.bicep") || messages.includes("variables.tf")) &&
    (messages.includes("module") || messages.includes("infra/") || messages.includes("resource"));

  // Scaffold subskill signal 2: manifest or self-review references
  const hasScaffoldArtifacts =
    messages.includes("scaffold-manifest") || messages.includes("self-review") || messages.includes("self-healing");

  // Scaffold subskill signal 3: IaC file write tool calls
  const toolCalls = getToolCalls(agentMetadata);
  const hasIaCWriteToolCall = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    const isWriteTool = toolName === "create_file" || toolName === "write_file" || toolName === "create";
    return isWriteTool && (args.includes(".tf") || args.includes(".bicep") || args.includes("infra/"));
  });

  return hasIaCGeneration || hasScaffoldArtifacts || hasIaCWriteToolCall;
}

/**
 * Stricter early terminator that only fires on ACTUAL IaC file writes (tool calls),
 * not text mentions like "I'll generate infra/main.bicep". Use for tests that need
 * the agent to reach the scaffold phase and produce real files (e.g., B15 validation).
 */
function shouldEarlyTerminateOnIaCFileWrite(agentMetadata: AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    // Bail if we've had enough tool calls without skill invocation — routing failed
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  // Only fire on actual create_file/write_file tool calls writing .bicep/.tf
  const toolCalls = getToolCalls(agentMetadata);
  const hasIaCWriteToolCall = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    const isWriteTool = toolName === "create_file" || toolName === "write_file" || toolName === "create";
    return isWriteTool && (args.includes(".bicep") || args.includes(".tf")) && args.includes("infra/");
  });

  return hasIaCWriteToolCall;
}

/**
 * Early terminate for existing IaC detection — fires when the agent acknowledges
 * existing infrastructure files in the workspace (evidence scaffold ran its
 * Step 2 "check for existing IaC" check).
 */
function shouldEarlyTerminateForExistingIaCDetection(agentMetadata: AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    // Bail if we've had enough tool calls without skill invocation — routing failed
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

  const detectsExistingIaC =
    (messages.includes("existing") || messages.includes("already") || messages.includes("found") || messages.includes("detected")) &&
    (messages.includes("bicep") || messages.includes("terraform") || messages.includes("infra") || messages.includes("azure.yaml") || messages.includes("infrastructure"));

  return detectsExistingIaC;
}

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_scaffold - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("scaffold-delegation", () => {
    test("parent delegates to scaffold for IaC generation prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          // Delegation-only test — validates routing, not the full scaffold pipeline.
          // No follow-ups: shouldEarlyTerminateForSkillInvocation fires after routing.
          const agentMetadata = await agent.run({
            setup: async (workspace: string) => {
              await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
            },
            prompt: "I built a side project and want to get it live on Azure",
            nonInteractive: true,
            preserveWorkspace: true,
            shouldEarlyTerminate: (metadata) =>
              shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }

          // Scaffold-specific content assertions (non-blocking)
          const hasIaCContent =
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "main.tf") ||
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "main.bicep") ||
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "terraform") ||
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "bicep");

          if (!hasIaCContent) {
            agentMetadata.testComments.push("⚠️ SCAFFOLD: No IaC file names in output — agent may not have reached scaffold phase");
          }

          // Self-review check — scaffold SKILL.md requires adversarial self-review after IaC generation
          const hasSelfReview =
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "self-review") ||
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "self review") ||
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "adversarial") ||
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "verification") ||
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "VERIFIED") ||
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "FLAGGED");
          if (!hasSelfReview) {
            agentMetadata.testComments.push("⚠️ SCAFFOLD: No self-review/adversarial verification in output — agent may not have completed scaffold phase");
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    }, testTimeoutMs);

    test("scaffold refuses when existing IaC detected", async () => {
      await withTestResult(async () => {
        // Golden prompt (prompts.json) — matches microblog-ai-remix catalog entry
        // Workspace has existing infra/ with main.bicep + azure.yaml
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/Azure-Samples/microblog-ai-remix", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I have a prototype ready — help me get it to production on Azure",
          followUp: [
            "Go with recommended options.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) => {
            // Require ≥5 tool calls before any early termination fires.
            // Previous runs (chronic 6 failures) fired at 1 call — before the
            // agent scanned the workspace and discovered existing IaC.
            if (getToolCalls(metadata).length < 5) return false;
            return shouldEarlyTerminateForExistingIaCDetection(metadata) ||
              shouldEarlyTerminateForScaffoldOutput(metadata);
          },
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must acknowledge existing IaC (hard assertion)
        const detectsExisting =
          messages.includes("existing") || messages.includes("already") ||
          messages.includes("found") || messages.includes("detected") ||
          messages.includes("main.bicep") || messages.includes("azure.yaml") ||
          messages.includes("bicep") || messages.includes("infra/");
        if (!detectsExisting) {
          agentMetadata.testComments.push("❌ SCAFFOLD: Did not detect existing IaC files in infra/");
        }
        expect(detectsExisting).toBe(true);

        // Must NOT silently generate new IaC files that overwrite existing ones
        const toolCalls = getToolCalls(agentMetadata);
        const overwroteIaC = toolCalls.some(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
          const isWriteTool = toolName === "create_file" || toolName === "write_file" || toolName === "create";
          return isWriteTool && (args.includes("main.bicep") || args.includes("main.tf") || args.includes("infra/"));
        });
        if (overwroteIaC) {
          agentMetadata.testComments.push("❌ SCAFFOLD VIOLATION: Agent overwrote existing IaC in infra/ without user confirmation");
        }
        expect(overwroteIaC).toBe(false);
      });
    }, testTimeoutMs);

    test("scaffold generates Bicep for simple Express app", async () => {
      await withTestResult(async () => {
        // bya-simple-web-app: Express + SQLite + bcrypt, no existing IaC
        // Golden prompt routes to azure-app-onboard reliably; followUp pushes into scaffold phase
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I built a side project and want to get it live on Azure",
          followUp: [
            "Go with recommended options.",
            "Yes, generate the Bicep infrastructure code.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnIaCFileWrite,
        });

        // Scaffold-specific: IaC content present (Bicep or Terraform)
        const hasIaCContent =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "main.bicep") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "bicep") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "infra/");
        if (!hasIaCContent) {
          agentMetadata.testComments.push("⚠️ SCAFFOLD: No Bicep/IaC file names in output — agent may not have reached scaffold phase");
        }

        // Secure defaults: managed identity, RBAC, or Key Vault mentioned
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const hasSecureDefaults =
          messages.includes("managed identity") || messages.includes("managed-identity") ||
          messages.includes("key vault") || messages.includes("keyvault") ||
          messages.includes("rbac") || messages.includes("least privilege");
        if (!hasSecureDefaults) {
          agentMetadata.testComments.push("⚠️ SCAFFOLD: No secure defaults (managed identity/RBAC/Key Vault) mentioned");
        }

        // Must NOT deploy without approval — only check shell/powershell tool calls,
        // NOT create_file/write_file (which may mention deploy commands in documentation text)
        const toolCalls = getToolCalls(agentMetadata);
        const shellToolNames = ["powershell", "shell", "run_command", "bash", "terminal"];
        const hasDeployCmd = toolCalls.some(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          if (!shellToolNames.some(s => toolName.includes(s))) return false;
          const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
          return args.includes("azd up") || args.includes("azd provision") ||
            args.includes("az deployment") || args.includes("terraform apply");
        });
        if (hasDeployCmd) {
          agentMetadata.testComments.push("❌ SCAFFOLD VIOLATION: Agent executed deploy commands without approval");
        }
        expect(hasDeployCmd).toBe(false);
      });
    }, testTimeoutMs);
  });
});
