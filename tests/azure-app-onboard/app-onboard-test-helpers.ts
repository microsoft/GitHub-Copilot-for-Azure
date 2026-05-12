/**
 * Shared helpers for azure-app-onboard integration tests.
 *
 * Extracted so test files can run in parallel across Jest workers
 * while sharing early-termination logic and assertion functions.
 */

import {
  isSkillInvoked,
  doesAssistantOrToolsIncludeKeyword,
  getAllAssistantMessages,
  getToolCalls,
} from "../utils/evaluate";
import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../utils/agent-runner";
import type { AgentMetadata } from "../utils/agent-runner";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export const SKILL_NAME = "azure-app-onboard";
export const RUNS_PER_PROMPT = 1;
export const invocationRateThreshold = 0.8;
export const testTimeoutMs = 1800000; // 30 minutes per test
export const negativeTestTimeoutMs = 900000; // 15 minutes — negative tests with multi-turn follow-ups need headroom

/**
 * Early terminate ONLY on routing failure — if the skill is not invoked after
 * several tool calls, bail out. If the skill IS invoked, let the agent keep
 * running so it can produce pipeline outputs (services, costs, follow-ups).
 *
 * Use this for tests that assert on pipeline content (service recommendations,
 * dollar amounts, SKU codes) where the agent needs multiple API calls to
 * reach those outputs. Sub-skill tests (deploy, prepare, scaffold) use
 * shouldEarlyTerminateForSkillInvocation instead — they only need routing confirmation.
 */
export function shouldEarlyTerminateOnRoutingFailure(agentMetadata: AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
  }
  return false;
}

/**
 * Early terminate once AppOnboard presents the approval gate (plan + cost estimate).
 * Detects the "Ready to proceed?" pattern from Step 5 of the AppOnboard workflow.
 * Also detects inline plan presentations that skip the explicit gate.
 * This prevents the agent from attempting actual Azure deployment (which requires auth).
 */
export function shouldEarlyTerminateForPlanPresented(agentMetadata: AgentMetadata): boolean {
  // Don't terminate until the skill tool call has actually executed.
  // Without this guard, the agent's introductory text (e.g. "deploy") can match
  // the inline plan pattern on the same event that carries the skill() tool request,
  // aborting the session before tool.execution_start fires — making isSkillInvoked() return false.
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    // Bail if we've had enough tool calls without skill invocation — routing failed
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

  // Explicit approval gate pattern — matches the prescribed gate text from SKILL.md:
  //   "Ready to proceed with scaffolding? (Yes / Edit plan / Cancel)"
  //   "Ready to deploy? (Yes / Run manually / Edit plan / Cancel)"
  // Also catches common variations the agent uses.
  const hasExplicitGate =
    messages.includes("ready to proceed") ||
    messages.includes("ready to deploy") ||
    messages.includes("shall i proceed") ||
    (messages.includes("yes") && messages.includes("edit plan") && messages.includes("cancel"));

  // Scaffold/deploy escape hatch — agent skipped the gate and started writing IaC or deploying
  const toolCalls = getToolCalls(agentMetadata);
  const hasScaffoldOrDeploy = toolCalls.some(tc => {
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    const isIaCWrite = (tc.data.toolName === "create_file" || tc.data.toolName === "write_file") &&
      (args.includes(".bicep") || args.includes(".tf") || args.includes("main.bicep") || args.includes("main.tf"));
    const isDeployCmd = args.includes("azd up") || args.includes("azd provision") ||
      args.includes("az deployment") || args.includes("terraform apply");
    return isIaCWrite || isDeployCmd;
  });

  // Plan/assessment file escape hatch — agent wrote planning artifacts to the session directory.
  // SKILL.md specifies JSON artifacts: prereq-output.json, prepare-plan.json, scaffold-manifest.json.
  // But agents often hallucinate markdown variants (assessment.md, migration-plan.md).
  // Catch both the correct JSON artifacts and common hallucinated names.
  const hasPlanFileWrites = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    const isWriteTool = toolName === "create_file" || toolName === "write_file" || toolName === "create";
    return isWriteTool &&
      (args.includes("prepare-plan") || args.includes("prereq-output") || args.includes("scaffold-manifest") ||
       args.includes("assessment") || args.includes("migration-plan") || args.includes("plan.md") || args.includes("architecture-plan"));
  });

  if (hasExplicitGate || hasScaffoldOrDeploy || hasPlanFileWrites) {
    let comment: string;
    if (hasExplicitGate) {
      comment = "✅ AppOnboard approval gate detected — plan + cost estimate presented. Terminating before deployment.";
    } else if (hasScaffoldOrDeploy) {
      comment = "⚠️ AppOnboard scaffold/deploy detected — agent skipped approval gate and started writing IaC or deploying. Terminating.";
    } else {
      comment = "⚠️ AppOnboard plan file detected — agent wrote assessment/migration-plan to session directory. Terminating.";
    }
    if (!agentMetadata.testComments.some(c => c === comment)) {
      agentMetadata.testComments.push(comment);
    }
    return true;
  }
  return false;
}

/**
 * Assert the agent reached the approval gate (explicit "Ready to proceed?" or cost/plan presentation).
 * Soft assertion — logs a warning on failure instead of failing the test, but tracks gate hit rate.
 */
export function assertApprovalGateReached(agentMetadata: AgentMetadata): boolean {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const hasGate =
    messages.includes("ready to proceed") ||
    (messages.includes("yes") && messages.includes("cancel") && (messages.includes("cost") || messages.includes("$")));
  if (!hasGate) {
    agentMetadata.testComments.push("⚠️ APPROVAL GATE NOT REACHED — agent did not present explicit 'Ready to proceed?' prompt. May have inlined plan or skipped to scaffold/deploy.");
  }
  return hasGate;
}

/**
 * Assert the agent did NOT proceed to scaffold or deploy for negative test repos.
 * Checks tool calls for actual deploy commands and IaC file creation.
 *
 * Deploy signal = powershell/bash command containing azd up, azd provision,
 *   az deployment, or terraform apply.
 * Scaffold signal = create_file/write_file where the file PATH ends in
 *   .tf or .bicep (ignores file content that merely mentions these).
 */
export function assertDoesNotScaffoldOrDeploy(agentMetadata: AgentMetadata): void {
  const toolCalls = getToolCalls(agentMetadata);

  // Deploy = actual shell command executing deploy infrastructure
  const hasDeployToolCalls = toolCalls.some(tc => {
    if (tc.data.toolName !== "powershell" && tc.data.toolName !== "bash") return false;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    return cmd.includes("azd up") || cmd.includes("azd provision") ||
      cmd.includes("az deployment") || cmd.includes("terraform apply");
  });

  // Scaffold = creating an actual IaC file (check path, not content)
  const hasScaffoldFileWrites = toolCalls.some(tc => {
    if (tc.data.toolName !== "create_file" && tc.data.toolName !== "write_file") return false;
    const filePath = ((tc.data.arguments as Record<string, unknown>)?.path as string ?? "").toLowerCase();
    return filePath.endsWith(".tf") || filePath.endsWith(".bicep");
  });

  if (hasDeployToolCalls) {
    agentMetadata.testComments.push("❌ NEGATIVE VIOLATION: Agent executed deploy commands (azd up/provision, az deployment, terraform apply) on broken/unsupported repo");
  }
  if (hasScaffoldFileWrites) {
    agentMetadata.testComments.push("❌ NEGATIVE VIOLATION: Agent generated IaC files (.tf/.bicep) for broken/unsupported repo");
  }
  expect(hasDeployToolCalls).toBe(false);
  expect(hasScaffoldFileWrites).toBe(false);
}

/**
 * Check if a tool call is an IaC file write (create_file/write_file/create targeting main.bicep or main.tf).
 * Shared helper — eliminates 8+ inline copies of the same filtering logic across scaffold tests.
 */
export function isIaCFileWrite(tc: { data: { toolName: string; arguments?: unknown } }): boolean {
  const toolName = (tc.data.toolName ?? "").toLowerCase();
  if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return false;
  const filePath = ((tc.data.arguments as Record<string, unknown>)?.path as string ?? "").toLowerCase();
  return filePath.includes("main.bicep") || filePath.includes("main.tf");
}

/**
 * Early terminate for negative tests — fires when the agent starts scaffold/deploy
 * actions (IaC file writes, azd up, terraform apply). Prevents the agent from actually
 * deploying a broken/unsupported repo, regardless of whether follow-up messages
 * have landed yet. Lets the agent scan and present issues freely.
 */
export function shouldEarlyTerminateOnScaffoldOrDeploy(agentMetadata: AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    // Bail if we've had enough tool calls without skill invocation — routing failed
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const toolCalls = getToolCalls(agentMetadata);
  const hasDeployCmd = toolCalls.some(tc => {
    if (tc.data.toolName !== "powershell" && tc.data.toolName !== "bash") return false;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    return cmd.includes("azd up") || cmd.includes("azd provision") ||
      cmd.includes("az deployment") || cmd.includes("terraform apply");
  });

  const hasIaCWrite = toolCalls.some(tc => {
    if (tc.data.toolName !== "create_file" && tc.data.toolName !== "write_file") return false;
    const filePath = ((tc.data.arguments as Record<string, unknown>)?.path as string ?? "").toLowerCase();
    return filePath.endsWith(".tf") || filePath.endsWith(".bicep");
  });

  if (hasDeployCmd || hasIaCWrite) {
    agentMetadata.testComments.push("⚠️ EARLY TERMINATE: Agent started scaffold/deploy on negative repo — stopping before damage.");
    return true;
  }
  return false;
}

/**
 * Assert the agent flagged critical blocking issues (used for negative tests).
 * The agent must present issues as blocking — not just warnings.
 */
export function assertBlockingIssuesFlagged(agentMetadata: AgentMetadata, expectedKeywords: string[]): void {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const hasBlockingLanguage =
    messages.includes("blocked") || messages.includes("cannot proceed") ||
    messages.includes("must be resolved") || messages.includes("not ready") ||
    messages.includes("critical") || messages.includes("fix these") ||
    messages.includes("before deployment") || messages.includes("before proceeding");

  const foundKeywords = expectedKeywords.filter(kw => messages.includes(kw.toLowerCase()));

  if (!hasBlockingLanguage) {
    agentMetadata.testComments.push("⚠️ Agent flagged issues but did not use blocking language (blocked/cannot proceed/must be resolved/not ready)");
  }
  if (foundKeywords.length === 0) {
    agentMetadata.testComments.push(`⚠️ None of the expected keywords found: ${expectedKeywords.join(", ")}`);
  }

  expect(foundKeywords.length).toBeGreaterThan(0);
}

/**
 * Check that the agent created a session file in the workspace.
 * Outcome-based: we don't care whether the agent used `create` or PowerShell,
 * only that .copilot-azure/sessions/{uuid}/context.json exists.
 * Soft assertion — logs a warning on failure.
 */
export function assertSessionFileCreated(agentMetadata: AgentMetadata, workspacePath: string): void {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("⚠️ SESSION NOT CREATED: .copilot-azure/sessions/ directory does not exist in workspace");
    return;
  }
  const sessionFolders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  if (sessionFolders.length === 0) {
    agentMetadata.testComments.push("⚠️ SESSION NOT CREATED: .copilot-azure/sessions/ exists but contains no session folders");
    return;
  }
  const hasContextJson = sessionFolders.some(folder =>
    fs.existsSync(path.join(sessionDir, folder, "context.json")));
  if (!hasContextJson) {
    agentMetadata.testComments.push("⚠️ SESSION INCOMPLETE: session folder exists but context.json not found");
  } else {
    agentMetadata.testComments.push("✅ Session file verified: .copilot-azure/sessions/*/context.json exists in workspace");
  }
}

/**
 * Check that the agent explored the Dockerfile (via tool calls or assistant output).
 * Uses tool call args + assistant messages — doesn't require a specific tool name.
 * Soft assertion — logs a warning on failure.
 */
export function assertDockerfileExplored(agentMetadata: AgentMetadata): void {
  const toolCalls = getToolCalls(agentMetadata);
  const dockerfileInToolArgs = toolCalls.some(tc => {
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("dockerfile");
  });
  const dockerfileInMessages = doesAssistantOrToolsIncludeKeyword(agentMetadata, "dockerfile");

  if (!dockerfileInToolArgs && !dockerfileInMessages) {
    agentMetadata.testComments.push("⚠️ DOCKERFILE NOT EXPLORED: agent did not reference Dockerfile in tool calls or messages");
  } else if (!dockerfileInToolArgs) {
    agentMetadata.testComments.push("⚠️ Dockerfile mentioned in text but not accessed via tools — agent may not have read its contents");
  }
}

/**
 * Check that the agent explored package.json (via tool calls or assistant output).
 * Soft assertion — logs a warning on failure.
 */
export function assertPackageJsonExplored(agentMetadata: AgentMetadata): void {
  const toolCalls = getToolCalls(agentMetadata);
  const pkgInToolArgs = toolCalls.some(tc => {
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("package.json");
  });
  const pkgInMessages = doesAssistantOrToolsIncludeKeyword(agentMetadata, "package.json");

  if (!pkgInToolArgs && !pkgInMessages) {
    agentMetadata.testComments.push("⚠️ PACKAGE.JSON NOT EXPLORED: agent did not reference package.json in tool calls or messages");
  }
}

/**
 * Assert that the agent re-ran the prereq scan after applying a code fix (B7).
 *
 * Checks for the mandatory "🔄 Re-evaluation complete" output that Step 6.5
 * requires after any fix. If the agent set `fixesApplied` without this output,
 * it skipped re-verification — which is the B7 bug.
 *
 * Hard assertion — fails the test if re-evaluation evidence is missing AND
 * the agent applied a code fix (created a file the repo was missing).
 */
export function assertReEvaluationAfterFix(agentMetadata: AgentMetadata): void {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const toolCalls = getToolCalls(agentMetadata);

  // Did the agent create/write any source files? (not IaC — actual app code fixes)
  const createdSourceFiles = toolCalls.filter(tc => {
    if (tc.data.toolName !== "create" && tc.data.toolName !== "create_file" && tc.data.toolName !== "write_file") return false;
    const filePath = ((tc.data.arguments as Record<string, unknown>)?.file_path as string ??
      (tc.data.arguments as Record<string, unknown>)?.path as string ?? "").toLowerCase();
    // Source files = .js, .ts, .py, .cs, .go, etc. — exclude IaC (.bicep, .tf) and config (.yaml, .json in infra/)
    return /\.(js|ts|py|cs|go|java|rb|php|rs)$/.test(filePath) &&
      !filePath.includes("infra/") && !filePath.includes(".copilot-azure/");
  });

  if (createdSourceFiles.length === 0) {
    // No code fix was applied — B7 doesn't apply
    return;
  }

  // Agent applied a code fix — check for re-evaluation evidence
  const hasReEvalOutput = messages.includes("re-evaluation complete") ||
    messages.includes("🔄 re-evaluation") ||
    messages.includes("re-scan complete") ||
    messages.includes("issues resolved");

  if (!hasReEvalOutput) {
    agentMetadata.testComments.push(
      `❌ B7 VIOLATION: Agent created ${createdSourceFiles.length} source file(s) as a fix but did NOT re-run the prereq scan. ` +
      `SKILL.md Step 6.5 requires printing "🔄 Re-evaluation complete" after any fix. ` +
      `Files created: ${createdSourceFiles.map(tc => (tc.data.arguments as Record<string, unknown>)?.file_path ?? (tc.data.arguments as Record<string, unknown>)?.path).join(", ")}`
    );
  }
  expect(hasReEvalOutput).toBe(true);
}

/**
 * Check that phase artifacts exist in the session directory.
 * Soft assertion — logs which artifacts are present/missing.
 */
export function assertPhaseArtifactsExist(agentMetadata: AgentMetadata, workspacePath: string, requiredArtifacts: string[]): void {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("⚠️ SESSION DIR MISSING: .copilot-azure/sessions/ does not exist — cannot check artifacts");
    return;
  }
  const sessionFolders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  if (sessionFolders.length === 0) {
    agentMetadata.testComments.push("⚠️ NO SESSION FOLDERS: cannot check artifacts");
    return;
  }

  for (const artifact of requiredArtifacts) {
    const found = sessionFolders.some(folder =>
      fs.existsSync(path.join(sessionDir, folder, artifact)));
    if (found) {
      agentMetadata.testComments.push(`✅ Artifact present: ${artifact}`);
    } else {
      agentMetadata.testComments.push(`⚠️ ARTIFACT MISSING: ${artifact} not found in any session folder`);
    }
  }
}

/**
 * Check that context.json shows phase progression (completedPhases updated).
 * Soft assertion — logs whether lifecycle was maintained.
 */
export function assertContextJsonProgression(agentMetadata: AgentMetadata, workspacePath: string): void {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) return;
  const sessionFolders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  if (sessionFolders.length === 0) return;

  for (const folder of sessionFolders) {
    const ctxPath = path.join(sessionDir, folder, "context.json");
    if (!fs.existsSync(ctxPath)) continue;
    try {
      const ctx = JSON.parse(fs.readFileSync(ctxPath, "utf-8"));
      const phases = ctx.completedPhases ?? [];
      if (phases.length > 0) {
        agentMetadata.testComments.push(`✅ Phase lifecycle maintained: completedPhases=[${phases.join(",")}], currentPhase=${ctx.currentPhase ?? "null"}`);
      } else {
        agentMetadata.testComments.push("⚠️ PHASE LIFECYCLE STALE: completedPhases is empty — context.json may be write-once (B27)");
      }
    } catch {
      agentMetadata.testComments.push("⚠️ context.json parse error — cannot verify phase lifecycle");
    }
    return; // Only check first session folder
  }
}

/**
 * Early terminate for Container Apps deploy tests.
 * Fires when:
 * (a) Agent starts ACR builds (good — code deploy happening), OR
 * (b) Agent presents "Next Steps" with manual docker/CLI commands (bad — B50 reproduced), OR
 * (c) Agent writes deploy-result.json (deploy completed)
 *
 * Both good and bad signals mean the test has captured the relevant behavior.
 */
export function shouldEarlyTerminateOnContainerAppsCodeDeploy(agentMetadata: AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    // Bail if we've had enough tool calls without skill invocation — routing failed
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const toolCalls = getToolCalls(agentMetadata);

  // Good signal: agent is running ACR builds
  const hasAcrBuild = toolCalls.some(tc => {
    if (tc.data.toolName !== "powershell" && tc.data.toolName !== "bash") return false;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    return cmd.includes("az acr build");
  });

  // Good signal: agent is running Bicep deployment (az deployment sub/group create)
  const hasBicepDeploy = toolCalls.some(tc => {
    if (tc.data.toolName !== "powershell" && tc.data.toolName !== "bash") return false;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    return cmd.includes("az deployment sub create") || cmd.includes("az deployment group create");
  });

  // Bad signal: agent presented manual "Next Steps" for code deploy
  const hasManualNextSteps =
    /next steps.{0,100}(docker build|docker push|deploy your code|az containerapp update)/i.test(messages);

  // Bad signal: agent used Terraform instead of Bicep
  const hasTerraformApply = toolCalls.some(tc => {
    if (tc.data.toolName !== "powershell" && tc.data.toolName !== "bash") return false;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    return cmd.includes("terraform apply") || cmd.includes("terraform init");
  });

  // Good signal: deploy-result.json written (deploy completed)
  const hasDeployResult = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "create" && toolName !== "create_file" && toolName !== "write_file") return false;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("deploy-result");
  });

  if (hasTerraformApply) {
    agentMetadata.testComments.push("❌ Agent used Terraform instead of Bicep — wrong IaC path. Terminating early.");
    return true;
  }
  if (hasAcrBuild) {
    agentMetadata.testComments.push("✅ ACR build detected — agent is deploying code, not just IaC.");
    return true;
  }
  // Note: hasBicepDeploy is NOT a termination signal — Bicep infra provisioning happens
  // BEFORE ACR builds. Terminating here would kill the test before code deploy phase.
  if (hasBicepDeploy && !agentMetadata.testComments.some(c => c.includes("Bicep deployment"))) {
    agentMetadata.testComments.push("✅ Bicep deployment in progress (az deployment create) — infra provisioning, ACR builds expected next.");
  }
  if (hasManualNextSteps) {
    agentMetadata.testComments.push("❌ B50 REPRODUCED: Agent presented manual 'Next Steps' for code deploy instead of executing it.");
    return true;
  }
  if (hasDeployResult) {
    agentMetadata.testComments.push("✅ deploy-result.json written — deploy phase completed.");
    return true;
  }
  return false;
}

/**
 * Assert the agent did NOT run any `azd` commands during the app-onboard pipeline.
 * The skill MUST use `az deployment sub create` / `az deployment group create` — never azd.
 * `azd` commands create orphan `azd-permission-test-*` resource groups and diverge from
 * the IaC-only deploy path.
 *
 * Non-fatal by default (logs warning). Set `hard = true` to fail the test.
 */
export function assertNoAzdCommands(agentMetadata: AgentMetadata, hard = false): void {
  const toolCalls = getToolCalls(agentMetadata);
  const violations: string[] = [];

  for (const tc of toolCalls) {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "powershell" && toolName !== "bash" && toolName !== "run_command" && toolName !== "run_in_terminal") continue;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    // Match any azd subcommand (azd up, azd auth login, azd init, azd provision, azd deploy, etc.)
    if (/\bazd\s+\w+/.test(cmd)) {
      violations.push(`${tc.data.toolName}: ${cmd.substring(0, 120)}`);
    }
  }

  if (violations.length > 0) {
    agentMetadata.testComments.push(`❌ AZD PROHIBITION: Agent ran azd commands (creates orphan azd-permission-test RGs): ${violations.join("; ")}`);
    if (hard) {
      expect(violations).toHaveLength(0);
    }
  }
}

/**
 * Extract AppOnboard session IDs from agentMetadata tool calls.
 * Scans ALL tool calls for UUIDs that appear in session-related contexts:
 *   1. File writes to `.copilot-azure/sessions/{uuid}/`
 *   2. Terminal commands containing `session-id={uuid}` tags (az group create, az deployment)
 *   3. Terminal commands with `sessionId={uuid}` parameters
 * Deterministic — only returns UUIDs from actual tool calls this test performed.
 */
export function extractSessionIds(agentMetadata: AgentMetadata): string[] {
  const sessionIds = new Set<string>();
  const toolCalls = getToolCalls(agentMetadata);

  for (const tc of toolCalls) {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    const args = JSON.stringify(tc.data.arguments ?? "");

    // Source 1: file writes to .copilot-azure/sessions/{uuid}/
    if (toolName === "create_file" || toolName === "create" || toolName === "write_file") {
      const sessionPathMatch = args.match(/\.copilot-azure[\\/]+sessions[\\/]+([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
      if (sessionPathMatch) {
        sessionIds.add(sessionPathMatch[1].toLowerCase());
      }
    }

    // Source 2: terminal commands containing session-id tags or sessionId params
    // Catches: az group create --tags ...session-id={uuid}
    //          az deployment sub create --parameters sessionId={uuid}
    if (toolName === "run_in_terminal" || toolName === "powershell" || toolName === "bash" || toolName === "run_command") {
      const sessionTagMatches = args.matchAll(/session[_-]id[=:]\s*["']?([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi);
      for (const m of sessionTagMatches) {
        sessionIds.add(m[1].toLowerCase());
      }
    }
  }

  return Array.from(sessionIds);
}

/**
 * Clean up Azure resource groups created by a specific AppOnboard test.
 * Uses session IDs extracted from agentMetadata to find RGs tagged with
 * `app-onboard-session-id={sessionId}` — only deletes RGs from this exact test run.
 *
 * Deterministic: session IDs are UUID v4 (unique per test), extracted from
 * tool calls (not guessed). Zero chance of deleting another test's resources.
 *
 * Non-fatal: logs failures but never throws — safe to call in afterEach/finally.
 */
export function cleanupSessionResourceGroups(agentMetadata: AgentMetadata): void {
  const sessionIds = extractSessionIds(agentMetadata);
  if (sessionIds.length === 0) return;

  for (const sessionId of sessionIds) {
    try {
      const rgListOutput = execSync(
        `az group list --tag app-onboard-session-id=${sessionId} --query "[].name" -o tsv`,
        { encoding: "utf-8", timeout: 30_000 },
      ).trim();

      if (!rgListOutput) continue;

      const rgNames = rgListOutput.split(/\r?\n/).filter(Boolean);
      console.log(`🧹 Cleaning up ${rgNames.length} RG(s) for session ${sessionId}: ${rgNames.join(", ")}`);

      for (const rg of rgNames) {
        try {
          execSync(`az group delete -n "${rg}" --yes --no-wait`, { encoding: "utf-8", timeout: 30_000 });
          console.log(`   ✅ Deletion initiated: ${rg}`);
        } catch {
          console.log(`   ⚠️ Failed to delete ${rg} (may already be deleting)`);
        }
      }
    } catch {
      // az CLI not authenticated or query failed — not fatal
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// R1 + R2: Integration Test Wrappers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a standard integration describe block with skip logic.
 * Eliminates ~15 lines of boilerplate per test file.
 */
export function describeAppOnboard(
  suiteName: string,
  fn: (agent: ReturnType<typeof useAgentRunner>) => void,
): void {
  const skip = shouldSkipIntegrationTests();
  if (skip) {
    const reason = getIntegrationSkipReason();
    if (reason) console.log(`⏭️  Skipping integration tests: ${reason}`);
  }
  (skip ? describe.skip : describe)(`${SKILL_NAME}_ - ${suiteName}`, () => {
    const agent = useAgentRunner();
    fn(agent);
  });
}

/**
 * Like describeAppOnboard but wraps the agent with afterEach cleanup.
 * Use for tests that may create Azure resources (deploy, scaffold).
 */
export function describeAppOnboardWithCleanup(
  suiteName: string,
  fn: (agent: ReturnType<typeof useAgentRunner>) => void,
): void {
  const skip = shouldSkipIntegrationTests();
  if (skip) {
    const reason = getIntegrationSkipReason();
    if (reason) console.log(`⏭️  Skipping integration tests: ${reason}`);
  }
  (skip ? describe.skip : describe)(`${SKILL_NAME}_ - ${suiteName}`, () => {
    const _agent = useAgentRunner();
    let lastMetadata: AgentMetadata | undefined;
    afterEach(() => {
      if (lastMetadata) {
        assertNoAzdCommands(lastMetadata);
        cleanupSessionResourceGroups(lastMetadata);
        lastMetadata = undefined;
      }
    });
    const agent = {
      run: async (...args: Parameters<typeof _agent.run>) => {
        const m = await _agent.run(...args);
        lastMetadata = m;
        return m;
      },
    };
    fn(agent as unknown as ReturnType<typeof useAgentRunner>);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// R5: Routing Bailout Combinator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wrap an early-termination check with routing-failure bailout.
 * If the skill is not invoked after 3+ tool calls, terminates early.
 */
export function withRoutingBailout(
  innerCheck: (metadata: AgentMetadata) => boolean,
): (metadata: AgentMetadata) => boolean {
  return (metadata: AgentMetadata): boolean => {
    if (!isSkillInvoked(metadata, SKILL_NAME)) {
      if (getToolCalls(metadata).length > 3) {
        metadata.testComments.push(
          `⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(metadata).length} tool calls — terminating (routing failure).`,
        );
        return true;
      }
      return false;
    }
    return innerCheck(metadata);
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// New Early Terminators
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Early terminate once the agent reaches handoff phase.
 * Detects cleanup commands, deployment identity, or next-steps.
 */
export function shouldEarlyTerminateOnHandoff(metadata: AgentMetadata): boolean {
  return withRoutingBailout((m) => {
    const messages = getAllAssistantMessages(m).toLowerCase();
    const hasCleanup = messages.includes("az group delete") || messages.includes("clean up") || messages.includes("remove the resource");
    const hasNextSteps = (messages.includes("next step") || messages.includes("post-deploy")) && messages.includes("recommend");
    const hasDeployIdentity = messages.includes("deployed by") || messages.includes("signed in as");
    return hasCleanup || hasNextSteps || hasDeployIdentity;
  })(metadata);
}

/**
 * Early terminate once deploy-result.json is written.
 */
export function shouldEarlyTerminateOnDeployResult(metadata: AgentMetadata): boolean {
  return withRoutingBailout((m) => {
    const toolCalls = getToolCalls(m);
    return toolCalls.some(tc => {
      const toolName = (tc.data.toolName ?? "").toLowerCase();
      if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return false;
      const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
      return args.includes("deploy-result");
    });
  })(metadata);
}

/**
 * Early terminate once the azure.yaml decision gate is presented.
 */
export function shouldEarlyTerminateOnAzdDecisionGate(metadata: AgentMetadata): boolean {
  return withRoutingBailout((m) => {
    const messages = getAllAssistantMessages(m).toLowerCase();
    return (
      (messages.includes("azure.yaml") || messages.includes("azd")) &&
      (messages.includes("existing") || messages.includes("found") || messages.includes("detected")) &&
      (messages.includes("deploy using") || messages.includes("start fresh") ||
       messages.includes("use existing") || messages.includes("create new") ||
       messages.includes("option") || messages.includes("choice"))
    );
  })(metadata);
}

/**
 * Early terminate once the agent acknowledges a user override (IaC format change).
 */
export function shouldEarlyTerminateOnUserOverride(metadata: AgentMetadata): boolean {
  return withRoutingBailout((m) => {
    const messages = getAllAssistantMessages(m).toLowerCase();
    return (
      (messages.includes("switch") || messages.includes("changed") || messages.includes("updated")) &&
      (messages.includes("terraform") || messages.includes("bicep")) &&
      (messages.includes("regenerat") || messages.includes("re-scaffold") || messages.includes("new infra") || messages.includes("re-generat"))
    );
  })(metadata);
}

// ═══════════════════════════════════════════════════════════════════════════
// New Assertions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hard version of assertApprovalGateReached — fails the test.
 */
export function assertApprovalGateReachedHard(agentMetadata: AgentMetadata): void {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const hasGate =
    messages.includes("ready to proceed") ||
    messages.includes("ready to deploy") ||
    messages.includes("shall i proceed") ||
    (messages.includes("yes") && messages.includes("cancel") && (messages.includes("cost") || messages.includes("$")));
  if (!hasGate) {
    agentMetadata.testComments.push("❌ APPROVAL GATE NOT REACHED — agent did not present explicit approval prompt");
  }
  expect(hasGate).toBe(true);
}

/**
 * Validate prepare-plan.json schema against PreparePlan interface.
 * Hard assertion — fails if schema is malformed.
 */
export function assertPreparePlanSchema(agentMetadata: AgentMetadata, workspacePath: string): void {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("⚠️ PREPARE PLAN: .copilot-azure/sessions/ not found");
    return;
  }
  const folders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  for (const folder of folders) {
    const planPath = path.join(sessionDir, folder, "prepare-plan.json");
    if (!fs.existsSync(planPath)) continue;
    try {
      const plan = JSON.parse(fs.readFileSync(planPath, "utf-8"));
      const missing: string[] = [];
      if (!plan.services || !Array.isArray(plan.services)) missing.push("services[]");
      if (!plan.naming) missing.push("naming");
      if (!plan.costEstimate) missing.push("costEstimate");
      if (!plan.iacFormat) missing.push("iacFormat");
      if (missing.length > 0) {
        agentMetadata.testComments.push(`❌ PREPARE PLAN SCHEMA: Missing fields: ${missing.join(", ")}`);
        expect(missing.length).toBe(0);
        return;
      }
      if (plan.services.length === 0) {
        agentMetadata.testComments.push("❌ PREPARE PLAN: services[] is empty");
        expect(plan.services.length).toBeGreaterThan(0);
        return;
      }
      for (const svc of plan.services) {
        if (!svc.type) agentMetadata.testComments.push(`⚠️ PREPARE PLAN: service missing 'type'`);
        if (!svc.sku) agentMetadata.testComments.push(`⚠️ PREPARE PLAN: service '${svc.type ?? "?"}' missing 'sku'`);
      }
      if (plan.naming && !plan.naming.resourceGroupName) {
        agentMetadata.testComments.push("⚠️ PREPARE PLAN: naming.resourceGroupName missing");
      }
      if (plan.costEstimate && plan.costEstimate.totalMonthlyUsd === undefined) {
        agentMetadata.testComments.push("⚠️ PREPARE PLAN: costEstimate.totalMonthlyUsd missing");
      }
      agentMetadata.testComments.push(
        `✅ PREPARE PLAN: Validated — ${plan.services.length} services, iacFormat=${plan.iacFormat}, cost=$${plan.costEstimate?.totalMonthlyUsd ?? "?"}/mo`,
      );
    } catch {
      agentMetadata.testComments.push("❌ PREPARE PLAN: Failed to parse prepare-plan.json");
      expect(false).toBe(true);
    }
    return;
  }
  agentMetadata.testComments.push("⚠️ PREPARE PLAN: prepare-plan.json not found in any session folder");
}

/**
 * Validate handoff phase output (Step 10).
 */
export function assertHandoffPresented(agentMetadata: AgentMetadata): void {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const hasDeployIdentity =
    messages.includes("deployed by") || messages.includes("deployment identity") ||
    messages.includes("service principal") || messages.includes("managed identity") ||
    messages.includes("signed in as") || messages.includes("authenticated as") ||
    messages.includes("subscription");
  if (!hasDeployIdentity) {
    agentMetadata.testComments.push("⚠️ HANDOFF: No deployment identity surfaced");
  }
  const hasCleanup =
    messages.includes("az group delete") || messages.includes("clean up") ||
    messages.includes("remove the resource") || messages.includes("delete the resource") ||
    messages.includes("tear down");
  if (!hasCleanup) {
    agentMetadata.testComments.push("⚠️ HANDOFF: No cleanup commands provided");
  }
  const hasRecommendations =
    messages.includes("next step") || messages.includes("recommend") ||
    messages.includes("consider") || messages.includes("post-deploy") ||
    messages.includes("you should") || messages.includes("suggestion");
  if (!hasRecommendations) {
    agentMetadata.testComments.push("⚠️ HANDOFF: No post-deploy recommendations");
  }
}

/**
 * Validate deploy-audit.log exists and has correct format.
 */
export function assertDeployAuditLog(agentMetadata: AgentMetadata, workspacePath: string): void {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("⚠️ AUDIT LOG: .copilot-azure/sessions/ not found");
    return;
  }
  const folders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  for (const folder of folders) {
    const auditPath = path.join(sessionDir, folder, "deploy-audit.log");
    if (!fs.existsSync(auditPath)) continue;
    const content = fs.readFileSync(auditPath, "utf-8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) {
      agentMetadata.testComments.push("⚠️ AUDIT LOG: deploy-audit.log exists but is empty");
      return;
    }
    const validFormat = /^\d{4}-\d{2}-\d{2}T[\d:]+.*\|.*\|(started|succeeded|failed)/i;
    let validCount = 0;
    for (const line of lines) {
      if (validFormat.test(line.trim())) validCount++;
    }
    agentMetadata.testComments.push(
      `${validCount === lines.length ? "✅" : "⚠️"} AUDIT LOG: ${validCount}/${lines.length} entries have valid format`,
    );
    return;
  }
  agentMetadata.testComments.push("⚠️ AUDIT LOG: deploy-audit.log not found in any session folder");
}

/**
 * Validate deploy-result.json schema.
 */
export function assertDeployResultSchema(agentMetadata: AgentMetadata, workspacePath: string): void {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("⚠️ DEPLOY RESULT: .copilot-azure/sessions/ not found");
    return;
  }
  const folders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  for (const folder of folders) {
    const resultPath = path.join(sessionDir, folder, "deploy-result.json");
    if (!fs.existsSync(resultPath)) continue;
    try {
      const result = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
      const requiredFields = ["status", "subscriptionId", "resourceGroupName"];
      const missing = requiredFields.filter(f => result[f] === undefined);
      if (missing.length > 0) {
        agentMetadata.testComments.push(`❌ DEPLOY RESULT: Missing fields: ${missing.join(", ")}`);
      } else {
        agentMetadata.testComments.push(`✅ DEPLOY RESULT: status=${result.status}, rg=${result.resourceGroupName}`);
      }
      if (result.healingAttempts && !Array.isArray(result.healingAttempts)) {
        agentMetadata.testComments.push("⚠️ DEPLOY RESULT: healingAttempts is not an array");
      }
      return;
    } catch {
      agentMetadata.testComments.push("❌ DEPLOY RESULT: Failed to parse deploy-result.json");
    }
  }
  agentMetadata.testComments.push("⚠️ DEPLOY RESULT: deploy-result.json not found");
}

/**
 * Validate that the healing loop pauses after 3 attempts.
 */
export function assertHealingLoopPaused(agentMetadata: AgentMetadata, workspacePath: string): void {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) return;
  const folders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  for (const folder of folders) {
    const resultPath = path.join(sessionDir, folder, "deploy-result.json");
    if (!fs.existsSync(resultPath)) continue;
    try {
      const result = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
      const attempts = result.healingAttempts ?? [];
      if (attempts.length >= 3) {
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const pausedForUser =
          messages.includes("try that") || messages.includes("suggestion") ||
          messages.includes("stop") || messages.includes("would you like") ||
          messages.includes("should i continue");
        if (!pausedForUser) {
          agentMetadata.testComments.push(
            `❌ HEALING LOOP: ${attempts.length} attempts without pausing for user (SKILL.md requires pause at 3)`,
          );
        } else {
          agentMetadata.testComments.push(`✅ HEALING LOOP: Paused for user after ${attempts.length} attempts`);
        }
      }
    } catch { /* handled elsewhere */ }
    return;
  }
}

/**
 * Validate scaffold-manifest.json has selfReview populated.
 */
export function assertScaffoldSelfReviewPopulated(agentMetadata: AgentMetadata, workspacePath: string): void {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("⚠️ SELF-REVIEW: .copilot-azure/sessions/ not found");
    return;
  }
  const folders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  for (const folder of folders) {
    const manifestPath = path.join(sessionDir, folder, "scaffold-manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (!manifest.selfReview) {
        agentMetadata.testComments.push("❌ SELF-REVIEW: scaffold-manifest.json.selfReview is null/undefined");
        expect(manifest.selfReview).toBeDefined();
        return;
      }
      if (manifest.selfReview.findings && Array.isArray(manifest.selfReview.findings)) {
        const flagged = manifest.selfReview.findings.filter((f: { status: string }) => f.status === "FLAGGED").length;
        const verified = manifest.selfReview.findings.filter((f: { status: string }) => f.status === "VERIFIED").length;
        agentMetadata.testComments.push(
          `✅ SELF-REVIEW: ${verified} VERIFIED, ${flagged} FLAGGED out of ${manifest.selfReview.findings.length} findings`,
        );
      } else {
        agentMetadata.testComments.push("⚠️ SELF-REVIEW: selfReview.findings missing or not an array");
      }
      if (manifest.healingAttempts !== undefined) {
        agentMetadata.testComments.push(`✅ SELF-HEALING: ${manifest.healingAttempts} healing attempts recorded`);
      }
      return;
    } catch {
      agentMetadata.testComments.push("⚠️ SELF-REVIEW: Failed to parse scaffold-manifest.json");
    }
  }
  agentMetadata.testComments.push("⚠️ SELF-REVIEW: scaffold-manifest.json not found");
}

/**
 * Assert the azure.yaml decision gate was presented.
 */
export function assertAzdDecisionGatePresented(agentMetadata: AgentMetadata): void {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const hasAzdDetection =
    (messages.includes("azure.yaml") || messages.includes("azd")) &&
    (messages.includes("existing") || messages.includes("found") || messages.includes("detected"));
  if (!hasAzdDetection) {
    agentMetadata.testComments.push("⚠️ AZD GATE: Agent did not detect existing azure.yaml");
  }
  const hasChoicePresented =
    messages.includes("deploy using existing") || messages.includes("start fresh") ||
    messages.includes("use existing") || messages.includes("create new") ||
    (messages.includes("option") && (messages.includes("azd") || messages.includes("azure.yaml")));
  if (!hasChoicePresented) {
    agentMetadata.testComments.push("⚠️ AZD GATE: Agent did not present choice (deploy existing vs start fresh)");
  }
}

/**
 * Assert AWS service migration mapping is handled.
 */
export function assertAwsMigrationMapping(agentMetadata: AgentMetadata, expectedMappings: { from: string; to: string }[]): void {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  for (const { from, to } of expectedMappings) {
    const mentionsTarget = messages.includes(to.toLowerCase());
    if (!mentionsTarget) {
      agentMetadata.testComments.push(`⚠️ AWS MIGRATION: Azure equivalent '${to}' not mentioned — expected mapping from '${from}'`);
    }
  }
}

/**
 * Assert docker-compose detection and mapping.
 */
export function assertDockerComposeDetected(agentMetadata: AgentMetadata): void {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const toolCalls = getToolCalls(agentMetadata);
  const detectedInMessages = messages.includes("docker-compose") || messages.includes("docker compose") || messages.includes("compose.y"); // matches compose.yml and compose.yaml
  const detectedInTools = toolCalls.some(tc => {
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("docker-compose") || args.includes("compose.y");
  });
  if (!detectedInMessages && !detectedInTools) {
    agentMetadata.testComments.push("⚠️ DOCKER-COMPOSE: Agent did not detect docker-compose file");
  }
}

/**
 * Assert database dependencies are detected and mapped to Azure services.
 */
export function assertDatabaseDetected(agentMetadata: AgentMetadata, dbType: string): void {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const dbLower = dbType.toLowerCase();
  const azureEquivalents: Record<string, string[]> = {
    postgresql: ["azure database for postgresql", "postgres", "flexible server"],
    mongodb: ["cosmos db", "cosmosdb", "mongo api"],
    redis: ["azure cache for redis", "redis"],
    dynamodb: ["cosmos db", "cosmosdb"],
    mysql: ["azure database for mysql", "mysql"],
    sqlite: ["app service", "container app", "ephemeral", "data loss"],
  };
  const equivalents = azureEquivalents[dbLower] ?? [];
  const mentionsAzureEquivalent = equivalents.some(eq => messages.includes(eq));
  if (!mentionsAzureEquivalent && equivalents.length > 0) {
    agentMetadata.testComments.push(`⚠️ DATABASE: No Azure equivalent for '${dbType}' mentioned (expected: ${equivalents.join(" or ")})`);
  }
}

/**
 * Assert the agent used the correct IaC format.
 */
export function assertIaCFormat(agentMetadata: AgentMetadata, workspacePath: string, expectedFormat: "bicep" | "terraform"): void {
  const walk = (dir: string, ext: string): string[] => {
    const files: string[] = [];
    if (!fs.existsSync(dir)) return files;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...walk(full, ext));
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        files.push(full);
      }
    }
    return files;
  };
  const bicepFiles = walk(workspacePath, ".bicep");
  const tfFiles = walk(workspacePath, ".tf");
  if (expectedFormat === "bicep") {
    if (bicepFiles.length === 0) {
      agentMetadata.testComments.push("❌ IAC FORMAT: Expected Bicep files but found none");
    }
    const agentGeneratedTf = tfFiles.some(f => path.relative(workspacePath, f).startsWith("infra"));
    if (agentGeneratedTf) {
      agentMetadata.testComments.push("⚠️ IAC FORMAT: Agent generated .tf files when Bicep was expected");
    }
  } else {
    if (tfFiles.length === 0) {
      agentMetadata.testComments.push("❌ IAC FORMAT: Expected Terraform files but found none");
    }
  }
}

/**
 * Read a session artifact from the workspace. Returns parsed JSON or null.
 */
export function readSessionArtifact<T = unknown>(workspacePath: string, artifactName: string): T | null {  
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) return null;
  const folders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  for (const folder of folders) {
    const artifactPath = path.join(sessionDir, folder, artifactName);
    if (!fs.existsSync(artifactPath)) continue;
    try {
      return JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Assert the agent scanned the workspace (via view/glob/powershell/read_file/list_dir).
 * Mirrors the Waza `scans_repo` grader: tool_name "view|glob|powershell", min_calls 1.
 */
export function assertAgentScannedWorkspace(agentMetadata: AgentMetadata): void {
  const toolCalls = getToolCalls(agentMetadata);
  const scanToolNames = ["view", "glob", "powershell", "bash", "read_file", "list_dir"];
  const hasScanCalls = toolCalls.some(tc => scanToolNames.includes(tc.data.toolName));
  if (!hasScanCalls) {
    agentMetadata.testComments.push("❌ SCAN: Agent did not scan workspace (no view/glob/powershell/read_file tool calls)");
  }
  expect(hasScanCalls).toBe(true);
}

/**
 * Assert the agent did NOT blindly approve or skip to architecture planning.
 * Mirrors Waza graders: does_not_blindly_approve, does_not_plan_architecture,
 * does_not_skip_to_architecture — all use the same NOT-match regex.
 */
export function assertDoesNotBlindlyApprove(agentMetadata: AgentMetadata): void {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const blindlyApproves =
    /here('s| is) (the|your) (full )?architecture plan/i.test(messages) ||
    messages.includes("everything looks good") ||
    messages.includes("no issues found");
  if (blindlyApproves) {
    agentMetadata.testComments.push("❌ BLIND APPROVAL: Agent approved/planned without completing evaluation");
  }
  expect(blindlyApproves).toBe(false);
}
