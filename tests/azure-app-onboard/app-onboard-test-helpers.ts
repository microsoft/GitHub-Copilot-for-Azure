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
  getAllToolText,
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
import * as os from "os";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve Azure credentials for fixture overlay.
 * Priority: env vars > `az account show` > leave placeholders unchanged.
 * Cached per process so `az` is called at most once across all tests.
 */
let cachedAzureCredentials: {
  subscriptionId: string;
  subscriptionName: string;
  tenantId: string;
  userDisplayName: string;
} | null = null;
let credentialsResolved = false;

function resolveAzureCredentials(): typeof cachedAzureCredentials {
  if (credentialsResolved) return cachedAzureCredentials;
  credentialsResolved = true;

  const subId = process.env.AZURE_SUBSCRIPTION_ID;
  const tenantId = process.env.AZURE_TENANT_ID;
  const userName = process.env.AZURE_USER_DISPLAY_NAME;

  // If all env vars are set, use them directly
  if (subId && tenantId && userName) {
    cachedAzureCredentials = {
      subscriptionId: subId,
      subscriptionName: process.env.AZURE_SUBSCRIPTION_NAME ?? "Test Subscription",
      tenantId,
      userDisplayName: userName,
    };
    return cachedAzureCredentials;
  }

  // Fallback: try az account show
  try {
    const raw = execSync("az account show --output json", {
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const account = JSON.parse(raw) as {
      id: string;
      name: string;
      tenantId: string;
      user?: { name?: string };
    };
    cachedAzureCredentials = {
      subscriptionId: subId ?? account.id,
      subscriptionName: process.env.AZURE_SUBSCRIPTION_NAME ?? account.name,
      tenantId: tenantId ?? account.tenantId,
      userDisplayName: userName ?? account.user?.name ?? "Test User",
    };
  } catch {
    // az CLI not available or not logged in — leave placeholders
    cachedAzureCredentials = null;
  }

  return cachedAzureCredentials;
}

/**
 * Overlay real Azure credentials onto fixture session artifacts in a seeded workspace.
 * Replaces placeholder values (00000000-..., "Test User") with the active Azure session
 * so deploy integration tests target the correct subscription.
 *
 * Safe to call even when no credentials are available — leaves files unchanged.
 */
function overlayAzureCredentials(workspace: string): void {
  const creds = resolveAzureCredentials();
  if (!creds) return;

  const PLACEHOLDER_GUID = "00000000-0000-0000-0000-000000000000";
  const PLACEHOLDER_USER = "Test User";
  const PLACEHOLDER_SUB_NAME = "placeholder";

  // Find all session directories
  const sessionsDir = path.join(workspace, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionsDir)) return;

  const sessionDirs = fs.readdirSync(sessionsDir).filter((name) => {
    const full = path.join(sessionsDir, name);
    return fs.statSync(full).isDirectory();
  });

  for (const sessionDir of sessionDirs) {
    const sessionPath = path.join(sessionsDir, sessionDir);

    // Patch context.json
    const contextFile = path.join(sessionPath, "context.json");
    if (fs.existsSync(contextFile)) {
      const ctx = JSON.parse(fs.readFileSync(contextFile, "utf-8"));
      if (ctx.azure) {
        if (ctx.azure.subscriptionId === PLACEHOLDER_GUID) ctx.azure.subscriptionId = creds.subscriptionId;
        if (ctx.azure.tenantId === PLACEHOLDER_GUID) ctx.azure.tenantId = creds.tenantId;
        if (ctx.azure.subscriptionName === PLACEHOLDER_SUB_NAME) ctx.azure.subscriptionName = creds.subscriptionName;
        if (ctx.azure.userDisplayName === PLACEHOLDER_USER) ctx.azure.userDisplayName = creds.userDisplayName;
        fs.writeFileSync(contextFile, JSON.stringify(ctx, null, 2) + "\n");
      }
    }

    // Patch deploy-result.json
    const deployResultFile = path.join(sessionPath, "deploy-result.json");
    if (fs.existsSync(deployResultFile)) {
      const dr = JSON.parse(fs.readFileSync(deployResultFile, "utf-8"));
      if (dr.subscriptionId === PLACEHOLDER_GUID) {
        dr.subscriptionId = creds.subscriptionId;
        fs.writeFileSync(deployResultFile, JSON.stringify(dr, null, 2) + "\n");
      }
    }

    // Patch prepare-plan.json
    const preparePlanFile = path.join(sessionPath, "prepare-plan.json");
    if (fs.existsSync(preparePlanFile)) {
      const pp = JSON.parse(fs.readFileSync(preparePlanFile, "utf-8"));
      if (pp.deploymentVariables?.deployedBy === PLACEHOLDER_USER) {
        pp.deploymentVariables.deployedBy = creds.userDisplayName;
        fs.writeFileSync(preparePlanFile, JSON.stringify(pp, null, 2) + "\n");
      }
    }

    // Patch deploy-checklist.md (subscription ID in header)
    const checklistFile = path.join(sessionPath, "deploy-checklist.md");
    if (fs.existsSync(checklistFile)) {
      let content = fs.readFileSync(checklistFile, "utf-8");
      content = content.replaceAll(PLACEHOLDER_GUID, creds.subscriptionId);
      fs.writeFileSync(checklistFile, content);
    }
  }

  // Patch infra/main.parameters.json
  const paramsFile = path.join(workspace, "infra", "main.parameters.json");
  if (fs.existsSync(paramsFile)) {
    const params = JSON.parse(fs.readFileSync(paramsFile, "utf-8"));
    if (params.parameters?.deployedBy?.value === PLACEHOLDER_USER) {
      params.parameters.deployedBy.value = creds.userDisplayName;
    }
    if (params.parameters?.deployerObjectId?.value === PLACEHOLDER_GUID) {
      let objectId = process.env.AZURE_USER_OBJECT_ID;
      if (!objectId) {
        try {
          objectId = execSync("az ad signed-in-user show --query id -o tsv", {
            encoding: "utf-8",
            timeout: 10_000,
            stdio: ["pipe", "pipe", "pipe"],
          }).trim();
        } catch {
          // az ad not available — leave placeholder
        }
      }
      params.parameters.deployerObjectId.value = objectId || PLACEHOLDER_GUID;
    }
    fs.writeFileSync(paramsFile, JSON.stringify(params, null, 2) + "\n");
  }
}

/**
 * Freshen hardcoded timestamps in fixture session artifacts so the session
 * looks recent. Without this, stale dates (e.g., months old) may confuse
 * the deploy agent or produce misleading Azure resource tags.
 *
 * Timeline: session created ~10min ago, scaffold completed ~5min ago.
 */
function freshenTimestamps(workspace: string): void {
  const now = new Date();
  const createdAt = new Date(now.getTime() - 10 * 60_000).toISOString();
  const modifiedAt = new Date(now.getTime() - 8 * 60_000).toISOString();
  const scaffoldAt = new Date(now.getTime() - 5 * 60_000).toISOString();

  const sessionsDir = path.join(workspace, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionsDir)) return;

  const sessionDirs = fs.readdirSync(sessionsDir).filter((name) => {
    const full = path.join(sessionsDir, name);
    return fs.statSync(full).isDirectory();
  });

  for (const sessionDir of sessionDirs) {
    const sessionPath = path.join(sessionsDir, sessionDir);

    // context.json — createdUtc, lastModifiedUtc
    const contextFile = path.join(sessionPath, "context.json");
    if (fs.existsSync(contextFile)) {
      const ctx = JSON.parse(fs.readFileSync(contextFile, "utf-8"));
      if (ctx.createdUtc) ctx.createdUtc = createdAt;
      if (ctx.lastModifiedUtc) ctx.lastModifiedUtc = modifiedAt;
      fs.writeFileSync(contextFile, JSON.stringify(ctx, null, 2) + "\n");
    }

    // deploy-result.json — duration.startedUtc
    const deployResultFile = path.join(sessionPath, "deploy-result.json");
    if (fs.existsSync(deployResultFile)) {
      const dr = JSON.parse(fs.readFileSync(deployResultFile, "utf-8"));
      if (dr.duration?.startedUtc) dr.duration.startedUtc = scaffoldAt;
      fs.writeFileSync(deployResultFile, JSON.stringify(dr, null, 2) + "\n");
    }

    // scaffold-manifest.json — scaffoldCompletedUtc
    const scaffoldFile = path.join(sessionPath, "scaffold-manifest.json");
    if (fs.existsSync(scaffoldFile)) {
      const sm = JSON.parse(fs.readFileSync(scaffoldFile, "utf-8"));
      if (sm.scaffoldCompletedUtc) sm.scaffoldCompletedUtc = scaffoldAt;
      fs.writeFileSync(scaffoldFile, JSON.stringify(sm, null, 2) + "\n");
    }
  }

  // main.parameters.json — createdAt
  const paramsFile = path.join(workspace, "infra", "main.parameters.json");
  if (fs.existsSync(paramsFile)) {
    const params = JSON.parse(fs.readFileSync(paramsFile, "utf-8"));
    if (params.parameters?.createdAt?.value) {
      params.parameters.createdAt.value = createdAt;
    }
    fs.writeFileSync(paramsFile, JSON.stringify(params, null, 2) + "\n");
  }
}

export const SKILL_NAME = "azure-app-onboard";
export const RUNS_PER_PROMPT = 1;
export const invocationRateThreshold = 0.8;
export const integrationTestTimeoutMs = 3_600_000; // 60 minutes — generous ceiling for ALL integration tests; early terminators handle stopping
export const remediationTestTimeoutMs = 7_200_000; // 120 minutes — remediation + quota pivot can exceed 60 min
export const testTimeoutMs = integrationTestTimeoutMs;
export const negativeTestTimeoutMs = integrationTestTimeoutMs;
export const prepareTestTimeoutMs = integrationTestTimeoutMs;
export const scaffoldTestTimeoutMs = integrationTestTimeoutMs;

/**
 * First follow-up for ALL app-onboard integration tests. Resolves the
 * 251-subscription gate in the test account so the pipeline can advance
 * to scope triage / prereq. Must be the first element in every followUp
 * array — custom test-specific follow-ups come after.
 */
export const SUBSCRIPTION_PRIMER = "Just go with defaults using my current subscription.";

/**
 * Standard follow-ups for full-pipeline tests that need to reach deployment.
 * Proven pattern from T1-T4 deploy-safety tests (100% pass rate across 10+ runs).
 *
 * Design: SUBSCRIPTION_PRIMER handles subscription + region in ONE turn.
 * Generic affirmatives push through scaffold gate → deploy gate → post-deploy.
 *
 * ANTI-PATTERN: Do NOT use problem-specific first follow-ups like "Fix the issues"
 * or "Use default subscription" — they get consumed by subscription resolution
 * (251 subs in test account) instead of advancing the pipeline.
 */
export const FULL_PIPELINE_FOLLOW_UPS = [
  SUBSCRIPTION_PRIMER,
  "Yes, proceed.",
  "Yes, deploy to Azure now.",
  "Yes, confirm the deployment.",
  "Continue.",
  "Yes, looks good.",
];

/**
 * Fixture branches are orphan branches in this repo whose root IS the deploy-ready
 * workspace snapshot (app code + infra/ + .copilot-azure/ session artifacts, captured
 * at "scaffold-complete, deploy-initiated"). Keeping the snapshots on dedicated
 * branches keeps large project copies out of `main`'s working tree while staying
 * entirely in-repo — no external forks.
 *
 * Regenerate a branch after updating a fixture's source tree:
 *   $t = git rev-parse "HEAD:<fixture path>"
 *   git branch -f <branch> (git commit-tree $t -m "update fixture")
 *   git push -f origin <branch>
 */
const FIXTURE_BRANCHES = {
  appService: "fixtures/deploy-app-service",
  containerApps: "fixtures/deploy-container-apps",
} as const;

/** Repo root of this checkout (the repo that has `origin` configured). */
function getRepoRoot(): string {
  return execSync("git rev-parse --show-toplevel", {
    cwd: __dirname,
    encoding: "utf-8",
  }).trim();
}

/**
 * Hydrate `workspace` from a fixture branch on origin, without leaving a .git dir.
 *
 * Fetches the branch into a per-branch local ref (parallel-worker safe — avoids the
 * shared FETCH_HEAD race) and extracts its tree via `git archive` → `tar`.
 */
function hydrateFromFixtureBranch(workspace: string, branch: string): void {
  const repoRoot = getRepoRoot();
  const name = path.basename(branch);
  const localRef = `refs/fixtures/${name}`;
  const tarFile = path.join(os.tmpdir(), `fixture-${name}-${process.pid}-${Date.now()}.tar`);
  try {
    execSync(`git fetch --depth 1 origin +${branch}:${localRef}`, {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    execSync(`git archive --format=tar -o "${tarFile}" ${localRef}`, {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    execSync(`tar -xf "${tarFile}" -C "${workspace}"`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    throw new Error(
      `Failed to hydrate deploy fixture from branch "${branch}". Ensure the branch ` +
      `exists on origin (git push origin ${branch}) and that git and tar are available.`,
      { cause: err },
    );
  } finally {
    fs.rmSync(tarFile, { force: true });
  }
}

/**
 * Seed a scaffold-completed App Service workspace (app code + infra/ + session
 * artifacts) so deploy-phase tests start at deploy instead of burning 20+ min in
 * scaffold. Hydrated from the `fixtures/deploy-app-service` branch.
 */
export function seedDeployReadyWorkspace(workspace: string): void {
  hydrateFromFixtureBranch(workspace, FIXTURE_BRANCHES.appService);
  overlayAzureCredentials(workspace);
  freshenTimestamps(workspace);
}

/**
 * Seed a scaffold-completed Container Apps workspace (app code + Dockerfile + infra/
 * + session artifacts) so Container Apps deploy-phase tests start at deploy instead
 * of burning 30+ min. Hydrated from the `fixtures/deploy-container-apps` branch.
 */
export function seedContainerAppsDeployReadyWorkspace(workspace: string): void {
  hydrateFromFixtureBranch(workspace, FIXTURE_BRANCHES.containerApps);
  overlayAzureCredentials(workspace);
  freshenTimestamps(workspace);
}

/**
 * Resume-style prompt for deploy-phase tests.
 * The workspace already has scaffold output — this tells the agent to proceed with deployment.
 * Uses explicit skill naming ("@azure-app-onboard") to force routing past the azure-deploy
 * competitor. Without this, "IaC ready" / "bring live" / "deploy" all pull the router toward
 * azure-deploy. These tests aren't testing routing — deploy-delegation covers that.
 */
export const DEPLOY_PHASE_PROMPT = "Use the azure-app-onboard skill to deploy my code to Azure.";

/**
 * Follow-ups for deploy-phase tests that resume from scaffold-complete.
 * Aligned with the deploy approval flow: subscription → confirm existing IaC → approve deploy.
 * Keep minimal — extra "Yes." answers fuel post-deploy actions (azure-upgrade, config changes)
 * that the agent self-initiates after the pipeline completes. shouldEarlyTerminate doesn't
 * abort during sendAndWait follow-ups, so fewer follow-ups = less post-pipeline activity.
 */
export const DEPLOY_PHASE_FOLLOW_UPS = [
  SUBSCRIPTION_PRIMER,
  "Yes.",
  "Yes.",
  "Yes.",
];

/**
 * Early terminate when ALL prereq artifacts have been written AND the agent has
 * produced its next assistant message (presenting findings / routing).
 *
 * Three-artifact gate:
 *  1. prereq-output.json written with components[] (create/edit)
 *  2. context.json updated with completedPhases (create/edit) — Step 1 creates a
 *     minimal context.json, Step 4 updates it via edit with the full schema
 *  3. readiness-report.md written (create)
 *
 * Only terminates when ALL 3 are detected + an assistant message after the LAST write.
 * The agent may write these across multiple turns (prereq-output first, then
 * context.json + readiness-report in a follow-up), so checking only prereq-output
 * would abort before the other two artifacts exist on disk.
 *
 * Also terminates on scaffold/deploy actions or routing failure.
 */
export function shouldEarlyTerminateOnPrereqComplete(agentMetadata: AgentMetadata, skillName: string): boolean {
  // Bail on routing failure
  if (!isSkillInvoked(agentMetadata, skillName) && !isSkillInvoked(agentMetadata, SKILL_NAME)) {
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${skillName} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const toolCalls = getToolCalls(agentMetadata);
  const isWriteTool = (tn: string): boolean =>
    tn === "create" || tn === "create_file" || tn === "write_file" || tn === "edit";

  // Artifact 1: prereq-output.json with components[]
  const prereqWriteEvent = toolCalls.find(tc => {
    if (!isWriteTool((tc.data.toolName ?? "").toLowerCase())) return false;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("prereq-output") && args.includes("components");
  });

  // Artifact 2: context.json with completedPhases (the Step 4 update, not the Step 1 minimal create)
  const contextUpdateEvent = toolCalls.find(tc => {
    if (!isWriteTool((tc.data.toolName ?? "").toLowerCase())) return false;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("context.json") && args.includes("completedphases");
  });

  // Artifact 3: readiness-report.md
  const reportWriteEvent = toolCalls.find(tc => {
    if (!isWriteTool((tc.data.toolName ?? "").toLowerCase())) return false;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("readiness-report");
  });

  if (prereqWriteEvent && contextUpdateEvent && reportWriteEvent) {
    // All 3 artifacts detected — wait for assistant message after the LAST write
    const lastWriteTimestamp = [prereqWriteEvent, contextUpdateEvent, reportWriteEvent]
      .map(e => e.timestamp)
      .sort()
      .pop()!;
    const hasAssistantMessageAfterWrite = agentMetadata.events.some(
      e => (e.type === "assistant.message" || e.type === "assistant.message_delta")
        && e.timestamp > lastWriteTimestamp,
    );
    if (hasAssistantMessageAfterWrite) {
      agentMetadata.testComments.push("✅ EARLY TERMINATE: prereq-output.json written with components[] + assistant responded — prereq phase complete.");
      return true;
    }
    // All 3 writes started but assistant hasn't responded yet — don't terminate.
    return false;
  }

  // Also terminate on scaffold/deploy (shouldn't happen in prereq, but safety net)
  const hasDeployOrScaffold = toolCalls.some(tc => {
    if (tc.data.toolName !== "powershell" && tc.data.toolName !== "bash") return false;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    return cmd.includes("azd up") || cmd.includes("azd provision") || cmd.includes("terraform apply");
  });

  if (hasDeployOrScaffold) {
    agentMetadata.testComments.push("⚠️ EARLY TERMINATE: Agent started scaffold/deploy — stopping.");
    return true;
  }

  return false;
}

/**
 * Early terminate after remediation completes — waits for the 2nd prereq-output.json
 * write (post-fix re-evaluation) AND a subsequent assistant message confirming all
 * artifacts are on disk.
 *
 * Uses the same two-phase gate as shouldEarlyTerminateOnPrereqComplete to avoid
 * aborting mid-batch and leaving files unwritten.
 *
 * Does NOT terminate on "Re-evaluation complete" assistant text alone — that message
 * appears BEFORE the agent writes the updated prereq-output.json with the new verdict.
 * Terminating on the text would kill the pending write and leave overallHealth stale.
 *
 * Use for remediation tests (e.g., bya-broken-web-app) where the agent must
 * detect → fix → re-evaluate before stopping.
 */
export function shouldEarlyTerminateAfterRemediation(agentMetadata: AgentMetadata, skillName: string): boolean {
  if (!isSkillInvoked(agentMetadata, skillName) && !isSkillInvoked(agentMetadata, SKILL_NAME)) {
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${skillName} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const toolCalls = getToolCalls(agentMetadata);
  const isFileWrite = (tn: string): boolean => tn === "create" || tn === "create_file" || tn === "write_file" || tn === "edit";

  // Phase 1: Find the 2nd prereq-output.json write = post-remediation re-evaluation done
  // Only match tool calls where the file_path/path argument itself targets prereq-output.json.
  // Do NOT match on JSON.stringify(arguments) — that catches context.json edits whose
  // old_str/new_str content happens to mention "prereq-output" in status summaries.
  const prereqWriteEvents = toolCalls.filter(tc => {
    if (!isFileWrite((tc.data.toolName ?? "").toLowerCase())) return false;
    const args = (tc.data.arguments ?? {}) as Record<string, unknown>;
    const filePath = (
      (args.file_path as string) ??
      (args.path as string) ??
      (args.filePath as string) ?? ""
    ).toLowerCase();
    return filePath.includes("prereq-output");
  });
  if (prereqWriteEvents.length >= 2) {
    // Phase 2: Wait for assistant message after the 2nd write
    const secondWriteTimestamp = prereqWriteEvents[1].timestamp;
    const hasAssistantMessageAfterWrite = agentMetadata.events.some(
      e => (e.type === "assistant.message" || e.type === "assistant.message_delta")
        && e.timestamp > secondWriteTimestamp,
    );
    if (hasAssistantMessageAfterWrite) {
      agentMetadata.testComments.push(`✅ EARLY TERMINATE: prereq-output.json written ${prereqWriteEvents.length}x + assistant responded — remediation complete.`);
      return true;
    }
    // 2nd write started but assistant hasn't responded yet — don't terminate.
    return false;
  }

  // Safety: stop on scaffold/deploy (shouldn't happen in prereq)
  const hasDeployOrScaffold = toolCalls.some(tc => {
    if (tc.data.toolName !== "powershell" && tc.data.toolName !== "bash") return false;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    return cmd.includes("azd up") || cmd.includes("azd provision") || cmd.includes("terraform apply");
  });
  if (hasDeployOrScaffold) {
    agentMetadata.testComments.push("⚠️ EARLY TERMINATE: scaffold/deploy detected — stopping.");
    return true;
  }

  return false;
}

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
  // IMPORTANT: "ready to deploy" alone is too broad — prereq readiness reports say
  // "ready to deploy to Azure" (declarative, not a gate question). Require "?" suffix
  // or gate options to distinguish the actual approval gate from prereq readiness text.
  const hasExplicitGate =
    messages.includes("ready to proceed") ||
    messages.includes("ready to deploy?") ||
    messages.includes("shall i proceed") ||
    (messages.includes("yes") && messages.includes("edit plan") && messages.includes("cancel"));

  // Scaffold/deploy escape hatch — agent skipped the gate and started writing IaC or deploying
  const toolCalls = getToolCalls(agentMetadata);
  const hasScaffoldOrDeploy = toolCalls.some(tc => {
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    const isIaCWrite = (tc.data.toolName === "create_file" || tc.data.toolName === "write_file") &&
      (args.includes(".bicep") || args.includes(".tf") || args.includes("main.bicep") || args.includes("main.tf"));
    // Only match deploy commands in actual shell executions — NOT in task/subagent prompts
    // that merely reference deploy commands as instructions. A `task` dispatch with
    // "az deployment" in its prompt text is teaching a subagent, not executing a deploy.
    const isShellTool = tc.data.toolName === "powershell" || tc.data.toolName === "bash";
    const isDeployCmd = isShellTool &&
      (args.includes("azd up") || args.includes("azd provision") ||
       args.includes("az deployment") || args.includes("terraform apply"));
    return isIaCWrite || isDeployCmd;
  });

  // Plan/assessment file escape hatch — agent wrote planning artifacts to the session directory.
  // SKILL.md specifies JSON artifacts: prereq-output.json, prepare-plan.json, scaffold-manifest.json.
  // But agents often hallucinate markdown variants (assessment.md, migration-plan.md).
  // Catch both the correct JSON artifacts and common hallucinated names.
  // IMPORTANT: prereq-output.json is EXCLUDED — it fires too early (before prereq completes)
  // and kills the agent before downstream artifact assertions can pass. Only trigger on
  // prepare-plan (post-prereq) and scaffold/deploy artifacts.
  // ONLY match the exact session artifact file names — prepare-plan.json and scaffold-manifest.json.
  // IMPORTANT: Only match tool calls that have COMPLETED (have a tool.execution_complete event),
  // not just tool.execution_start. The shouldEarlyTerminate callback fires during the event stream —
  // if we terminate on execution_start, the file write never completes and readSessionArtifact
  // returns null (the file never hits disk). We need the write to finish first.
  const completedToolCallIds = new Set(
    agentMetadata.events
      .filter(e => e.type === "tool.execution_complete")
      .map(e => (e.data as { toolCallId?: string }).toolCallId)
      .filter(Boolean),
  );
  const hasPlanFileWrites = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    const isWriteTool = toolName === "create_file" || toolName === "write_file" || toolName === "create";
    if (!isWriteTool) return false;
    // Only match if the write actually completed (file on disk)
    if (!completedToolCallIds.has(tc.data.toolCallId)) return false;
    const filePath = (
      (tc.data.arguments as Record<string, unknown>)?.path ??
      (tc.data.arguments as Record<string, unknown>)?.filePath ??
      ""
    ).toString().toLowerCase();
    return filePath.includes("prepare-plan") || filePath.includes("scaffold-manifest");
  });

  if (hasExplicitGate || hasScaffoldOrDeploy || hasPlanFileWrites) {
    let comment: string;
    if (hasExplicitGate) {
      comment = "✅ AppOnboard approval gate detected — plan + cost estimate presented. Terminating before deployment.";
    } else if (hasScaffoldOrDeploy) {
      comment = "⚠️ AppOnboard scaffold/deploy detected — agent skipped approval gate and started writing IaC or deploying. Terminating.";
    } else {
      comment = "✅ AppOnboard plan artifact written (prepare-plan.json or scaffold-manifest.json). Terminating before deployment.";
    }
    if (!agentMetadata.testComments.some(c => c === comment)) {
      agentMetadata.testComments.push(comment);
    }
    return true;
  }
  return false;
}

/**
 * Early terminator that waits for the explicit approval gate text or scaffold/deploy
 * actions — but does NOT fire on plan file writes alone.
 *
 * Use this for tests that need the agent to verbalize cost/plan info in chat
 * before terminating (e.g., cost-depth). The default shouldEarlyTerminateForPlanPresented
 * fires when prepare-plan.json is written, which can kill the agent before it
 * presents dollar amounts in the assistant messages.
 */
export function shouldEarlyTerminateForApprovalGate(agentMetadata: AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

  // IMPORTANT: "ready to deploy" alone is too broad — prereq readiness reports say
  // "ready to deploy to Azure" (declarative). Require "?" or gate options to distinguish.
  const hasExplicitGate =
    messages.includes("ready to proceed") ||
    messages.includes("ready to deploy?") ||
    messages.includes("shall i proceed") ||
    (messages.includes("yes") && messages.includes("edit plan") && messages.includes("cancel"));

  const toolCalls = getToolCalls(agentMetadata);
  const hasScaffoldOrDeploy = toolCalls.some(tc => {
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    const isIaCWrite = (tc.data.toolName === "create_file" || tc.data.toolName === "write_file") &&
      (args.includes(".bicep") || args.includes(".tf") || args.includes("main.bicep") || args.includes("main.tf"));
    const isShellTool = tc.data.toolName === "powershell" || tc.data.toolName === "bash";
    const isDeployCmd = isShellTool &&
      (args.includes("azd up") || args.includes("azd provision") ||
       args.includes("az deployment") || args.includes("terraform apply"));
    return isIaCWrite || isDeployCmd;
  });

  if (hasExplicitGate || hasScaffoldOrDeploy) {
    const comment = hasExplicitGate
      ? "✅ AppOnboard approval gate detected — plan + cost estimate presented. Terminating."
      : "⚠️ AppOnboard scaffold/deploy detected — agent skipped gate. Terminating.";
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
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "powershell" && toolName !== "bash" && toolName !== "run_in_terminal" && toolName !== "run_command") return false;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    return cmd.includes("azd up") || cmd.includes("azd provision") ||
      cmd.includes("az deployment") || cmd.includes("terraform apply");
  });

  // Scaffold = creating an actual IaC file (check path, not content)
  const hasScaffoldFileWrites = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return false;
    const argsObj = tc.data.arguments as Record<string, unknown> | undefined;
    const filePath = ((argsObj?.path ?? argsObj?.filePath ?? "") as string).toLowerCase();
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
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return false;
    const argsObj = tc.data.arguments as Record<string, unknown> | undefined;
    const filePath = ((argsObj?.path ?? argsObj?.filePath ?? "") as string).toLowerCase();
    return filePath.endsWith(".tf") || filePath.endsWith(".bicep");
  });

  if (hasDeployCmd || hasIaCWrite) {
    agentMetadata.testComments.push("⚠️ EARLY TERMINATE: Agent started scaffold/deploy on negative repo — stopping before damage.");
    return true;
  }

  // Halt detection — when the agent correctly identifies an unsupported/broken
  // repo and refuses to proceed, terminate early instead of burning 15+ minutes
  // on follow-up conversation about migration options.
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const agentHalted =
    (messages.includes("not ready") || messages.includes("cannot proceed") ||
     messages.includes("blocked") || messages.includes("halt") ||
     messages.includes("cannot deploy") || messages.includes("won't deploy") ||
     messages.includes("not supported") || messages.includes("end-of-life") ||
     messages.includes("eol")) &&
    toolCalls.length > 8; // enough tool calls to have done a real scan
  if (agentHalted) {
    agentMetadata.testComments.push("✅ EARLY TERMINATE: Agent correctly identified blocking issues and halted pipeline.");
    return true;
  }
  return false;
}

/**
 * Assert the agent flagged critical blocking issues (used for negative tests).
 * The agent must present issues as blocking — not just warnings.
 */
export function assertBlockingIssuesFlagged(agentMetadata: AgentMetadata, expectedKeywords: string[]): void {
  // Check both assistant messages AND tool outputs (prereq-output.json content)
  const allText = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();
  const hasBlockingLanguage =
    allText.includes("blocked") || allText.includes("cannot proceed") ||
    allText.includes("must be resolved") || allText.includes("not ready") ||
    allText.includes("critical") || allText.includes("fix these") ||
    allText.includes("before deployment") || allText.includes("before proceeding");

  const foundKeywords = expectedKeywords.filter(kw => allText.includes(kw.toLowerCase()));

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
 * Assert that the agent re-ran the prereq scan after applying a code fix.
 *
 * Checks for the mandatory "🔄 Re-evaluation complete" output that Step 6.5
 * requires after any fix. If the agent set `fixesApplied` without this output,
 * it skipped re-verification.
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
    // No code fix was applied — re-evaluation check doesn't apply
    return;
  }

  // Agent applied a code fix — check for re-evaluation evidence
  // Check assistant messages for re-eval phrasing
  const hasReEvalMessage = messages.includes("re-evaluation complete") ||
    messages.includes("🔄 re-evaluation") ||
    messages.includes("re-scan complete") ||
    messages.includes("issues resolved") ||
    messages.includes("re-evaluat") ||
    messages.includes("re-scan") ||
    messages.includes("re-check") ||
    messages.includes("scan again") ||
    messages.includes("checking again") ||
    messages.includes("re-running") ||
    messages.includes("verified") ||
    messages.includes("0 remaining") ||
    messages.includes("resolved");

  // Also check tool text (arguments passed to tools) — agent may describe re-eval there
  const toolText = getToolCalls(agentMetadata)
    .map(tc => JSON.stringify(tc.data.arguments ?? "").toLowerCase())
    .join(" ");
  const hasReEvalInTools = toolText.includes("re-evaluat") ||
    toolText.includes("re-scan") ||
    toolText.includes("checking again") ||
    toolText.includes("0 remaining") ||
    toolText.includes("issues resolved");

  // Check for a second write of prereq-output.json AFTER source file fixes
  // (the agent writes it once on initial scan, then again after re-evaluation)
  const lastSourceFixIndex = Math.max(
    ...createdSourceFiles.map(tc => toolCalls.indexOf(tc))
  );
  const prereqWritesAfterFix = toolCalls.filter((tc, idx) => {
    if (idx <= lastSourceFixIndex) return false;
    if (tc.data.toolName !== "create" && tc.data.toolName !== "create_file" && tc.data.toolName !== "write_file" && tc.data.toolName !== "edit") return false;
    const filePath = ((tc.data.arguments as Record<string, unknown>)?.file_path as string ??
      (tc.data.arguments as Record<string, unknown>)?.path as string ??
      (tc.data.arguments as Record<string, unknown>)?.filePath as string ?? "").toLowerCase();
    return filePath.includes("prereq-output.json");
  });

  const hasReEvalOutput = hasReEvalMessage || hasReEvalInTools || prereqWritesAfterFix.length > 0;

  if (!hasReEvalOutput) {
    agentMetadata.testComments.push(
      `❌ RE-EVALUATION VIOLATION: Agent created ${createdSourceFiles.length} source file(s) as a fix but did NOT re-run the prereq scan. ` +
      "The skill requires re-evaluation after applying fixes to catch regressions. " +
      `Files created: ${createdSourceFiles.map(tc => (tc.data.arguments as Record<string, unknown>)?.file_path ?? (tc.data.arguments as Record<string, unknown>)?.path).join(", ")}`
    );
  }
  expect(hasReEvalOutput).toBe(true);
}

/**
 * Check that phase artifacts exist in the session directory.
 * Hard assertion — fails if any required artifact is missing.
 */
export function assertPhaseArtifactsExist(agentMetadata: AgentMetadata, workspacePath: string, requiredArtifacts: string[]): void {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("❌ SESSION DIR MISSING: .copilot-azure/sessions/ does not exist — cannot check artifacts");
    expect(fs.existsSync(sessionDir)).toBe(true);
    return;
  }
  const sessionFolders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  if (sessionFolders.length === 0) {
    agentMetadata.testComments.push("❌ NO SESSION FOLDERS: cannot check artifacts");
    expect(sessionFolders.length).toBeGreaterThan(0);
    return;
  }

  const missingArtifacts: string[] = [];
  for (const artifact of requiredArtifacts) {
    const found = sessionFolders.some(folder =>
      fs.existsSync(path.join(sessionDir, folder, artifact)));
    if (found) {
      agentMetadata.testComments.push(`✅ Artifact present: ${artifact}`);
    } else {
      agentMetadata.testComments.push(`❌ ARTIFACT MISSING: ${artifact} not found in any session folder`);
      missingArtifacts.push(artifact);
    }
  }
  if (missingArtifacts.length > 0) {
    expect(missingArtifacts).toEqual([]);
  }
}

/**
 * Check that context.json shows phase progression (completedPhases updated).
 * Hard assertion — completedPhases must not be empty if the pipeline ran.
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
        agentMetadata.testComments.push("❌ PHASE LIFECYCLE STALE: completedPhases is empty — phase tracking must be maintained through the full pipeline");
        expect(phases.length).toBeGreaterThan(0);
      }
    } catch {
      agentMetadata.testComments.push("❌ context.json parse error — cannot verify phase lifecycle");
      expect(false).toBe(true);
    }
    return; // Only check first session folder
  }
}

/**
 * Early terminate for Container Apps deploy tests.
 * Fires when:
 * (a) Agent starts ACR builds (good — code deploy happening), OR
 * (b) Agent presents "Next Steps" with manual docker/CLI commands (bad — manual steps instead of executing), OR
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
  // Check file path specifically — not the entire stringified args blob
  const hasDeployResult = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "create" && toolName !== "create_file" && toolName !== "write_file") return false;
    const argsObj = (tc.data.arguments ?? {}) as Record<string, unknown>;
    const filePath = ((argsObj.path ?? argsObj.filePath ?? "") as string).toLowerCase();
    return filePath.includes("deploy-result");
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
    agentMetadata.testComments.push("❌ MANUAL STEPS REPRODUCED: Agent presented manual 'Next Steps' for code deploy instead of executing it.");
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
 * Check whether any shell (PowerShell/bash) tool call contains a given substring.
 * Use this instead of `getAllAssistantMessages().includes()` for CLI command checks —
 * assistant messages include file contents (deploy-checklist.md blocked patterns table)
 * which contain commands the agent is DOCUMENTING AS FORBIDDEN, not executing.
 * Checking messages causes false positives when the agent writes "never use az webapp update"
 * and the test detects "az webapp update" as a violation.
 */
export function shellCommandContains(agentMetadata: AgentMetadata, pattern: string | RegExp): boolean {
  const toolCalls = getToolCalls(agentMetadata);
  for (const tc of toolCalls) {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "powershell" && toolName !== "bash" && toolName !== "run_command" && toolName !== "run_in_terminal") continue;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    if (typeof pattern === "string") {
      if (cmd.includes(pattern)) return true;
    } else {
      if (pattern.test(cmd)) return true;
    }
  }
  return false;
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
        assertNoExternalSkillCalls(lastMetadata);
        assertNoDestructiveHealingCommands(lastMetadata);
        assertNoPasswordPrompts(lastMetadata);
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
 *
 * Gate: Only evaluates handoff signals AFTER `deployment-summary.md` has been written.
 * Without this gate, deploy-phase text that incidentally mentions "subscription" +
 * "resource group" triggers premature termination before the agent reaches Step 10.
 *
 * After the gate: requires ≥2 of 3 handoff signals (cleanup, identity, recommendations).
 * Matches the assertHandoffPresented threshold (≥2/3).
 */
export function shouldEarlyTerminateOnHandoff(metadata: AgentMetadata): boolean {
  return withRoutingBailout((m) => {
    // Gate: deployment-summary.md must be written before we evaluate handoff signals.
    // This artifact is created in deploy SKILL.md Step 8 (finalize) — its presence means
    // the agent has finished deploying and entered the handoff phase.
    const toolCalls = getToolCalls(m);
    const summaryWritten = toolCalls.some(tc => {
      const toolName = (tc.data.toolName ?? "").toLowerCase();
      if (toolName !== "create_file" && toolName !== "create" && toolName !== "write_file") return false;
      const args = tc.data.arguments as Record<string, unknown> ?? {};
      const filePath = ((args.path ?? args.filePath ?? "") as string).toLowerCase();
      const content = ((args.file_text ?? args.fileText ?? args.content ?? "") as string).toLowerCase();
      return filePath.includes("deployment-summary") || content.includes("deployment-summary");
    });
    if (!summaryWritten) return false;

    const messages = getAllAssistantMessages(m).toLowerCase();
    const hasCleanup = messages.includes("az group delete") || messages.includes("clean up") || messages.includes("remove the resource");
    const hasNextSteps = (messages.includes("next step") || messages.includes("post-deploy")) && messages.includes("recommend");
    const hasDeployIdentity = messages.includes("deployed by") || messages.includes("signed in as") ||
      (messages.includes("subscription") && (messages.includes("resource group") || messages.includes("region")));
    const hasRedeploy = messages.includes("redeploy") || messages.includes("re-deploy") || messages.includes("deploy again") || messages.includes("push code");
    const score = [hasCleanup, hasNextSteps, hasDeployIdentity, hasRedeploy].filter(Boolean).length;
    return score >= 3;
  })(metadata);
}

/**
 * Early terminate once deploy-result.json is written with a TERMINAL status.
 *
 * The scaffold validation sub-agent writes a skeleton deploy-result.json with
 * `"status": "pending"` — that's NOT a deploy result. Only fire when the file
 * contains a terminal status ("succeeded", "failed", "in-progress" with real
 * deployment data, i.e. after Step 5b+ in deploy/SKILL.md).
 */
export function shouldEarlyTerminateOnDeployResult(metadata: AgentMetadata): boolean {
  return withRoutingBailout((m) => {
    const toolCalls = getToolCalls(m);
    return toolCalls.some(tc => {
      const toolName = (tc.data.toolName ?? "").toLowerCase();
      if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return false;
      const args = tc.data.arguments as Record<string, unknown> ?? {};
      const argsStr = JSON.stringify(args).toLowerCase();
      if (!argsStr.includes("deploy-result")) return false;
      // Check file content for terminal status — skip scaffold skeleton ("pending")
      const fileText = (args.file_text as string ?? args.fileText as string ?? args.content as string ?? "").toLowerCase();
      if (fileText && fileText.includes('"status"')) {
        const hasPending = fileText.includes('"pending"');
        const hasTerminal = fileText.includes('"succeeded"') || fileText.includes('"failed"') || fileText.includes('"in-progress"');
        return hasTerminal && !hasPending;
      }
      // If we can't read the content, fire anyway (backwards-compat)
      return true;
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
 *
 * Condition 1: Agent acknowledges the override (broad — any common ack word).
 * Condition 2: Agent mentions the target IaC format.
 * Condition 3: Agent signals action (regenerate, update, use, proceed, etc.).
 */
export function shouldEarlyTerminateOnUserOverride(metadata: AgentMetadata): boolean {
  return withRoutingBailout((m) => {
    const messages = getAllAssistantMessages(m).toLowerCase();
    return (
      (messages.includes("switch") || messages.includes("changed") || messages.includes("updated") || messages.includes("noted") ||
       messages.includes("understood") || messages.includes("sure") || messages.includes("got it") ||
       messages.includes("i'll") || messages.includes("will ") || messages.includes("updat") || messages.includes("adjust")) &&
      (messages.includes("terraform") || messages.includes("bicep")) &&
      (messages.includes("regenerat") || messages.includes("re-scaffold") || messages.includes("new infra") || messages.includes("re-generat") ||
       messages.includes("will use terraform") || messages.includes("proceed with terraform") ||
       messages.includes("use terraform") || messages.includes("updat") || messages.includes("i'll use") ||
       messages.includes("generat") || messages.includes("instead") || messages.includes("i'll generat"))
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
    // pipeline-rules.md: scaffold gate = "Yes / Edit plan / Cancel", deploy gate = "Yes / Run manually / Edit plan / Cancel"
    (messages.includes("yes") && messages.includes("cancel") && (messages.includes("cost") || messages.includes("$") || messages.includes("edit plan") || messages.includes("run manually")));
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
      }
      if (plan.services && plan.services.length === 0) {
        agentMetadata.testComments.push("❌ PREPARE PLAN: services[] is empty");
      }
      for (const svc of (plan.services ?? [])) {
        if (!svc.type) agentMetadata.testComments.push("⚠️ PREPARE PLAN: service missing 'type'");
        if (!svc.sku) agentMetadata.testComments.push(`⚠️ PREPARE PLAN: service '${svc.type ?? "?"}' missing 'sku'`);
      }
      if (plan.naming && !plan.naming.resourceGroupName) {
        agentMetadata.testComments.push("⚠️ PREPARE PLAN: naming.resourceGroupName missing");
      }
      if (plan.costEstimate && plan.costEstimate.totalMonthlyUsd === undefined) {
        agentMetadata.testComments.push("⚠️ PREPARE PLAN: costEstimate.totalMonthlyUsd missing");
      }
      if (missing.length === 0 && plan.services?.length > 0) {
        agentMetadata.testComments.push(
          `✅ PREPARE PLAN: Validated — ${plan.services.length} services, iacFormat=${plan.iacFormat}, cost=$${plan.costEstimate?.totalMonthlyUsd ?? "?"}/mo`,
        );
      }
      // Hard assertions outside try/catch so Jest errors propagate correctly
      expect(missing.length).toBe(0);
      expect(plan.services?.length ?? 0).toBeGreaterThan(0);
    } catch (e) {
      // Only catch JSON parse errors — let Jest assertion errors propagate
      if (e instanceof SyntaxError) {
        agentMetadata.testComments.push("❌ PREPARE PLAN: Failed to parse prepare-plan.json — invalid JSON");
        expect(false).toBe(true);
      } else {
        throw e;
      }
    }
    return;
  }
  agentMetadata.testComments.push("⚠️ PREPARE PLAN: prepare-plan.json not found in any session folder");
}

/**
 * Validate handoff phase output.
 */
export function assertHandoffPresented(agentMetadata: AgentMetadata): void {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const hasDeployIdentity =
    messages.includes("deployed by") || messages.includes("deployment identity") ||
    messages.includes("service principal") || messages.includes("managed identity") ||
    messages.includes("signed in as") || messages.includes("authenticated as") ||
    messages.includes("subscription");
  if (!hasDeployIdentity) {
    agentMetadata.testComments.push("❌ HANDOFF: No deployment identity surfaced — handoff must surface deploy identity");
  }
  const hasCleanup =
    messages.includes("az group delete") || messages.includes("clean up") ||
    messages.includes("remove the resource") || messages.includes("delete the resource") ||
    messages.includes("tear down");
  if (!hasCleanup) {
    agentMetadata.testComments.push("❌ HANDOFF: No cleanup commands provided — handoff must include cleanup commands");
  }
  // handoff-protocol.md: Redeploy command is MANDATORY — user needs shortcut to redeploy after code changes
  const hasRedeployCommand =
    messages.includes("redeploy") || messages.includes("re-deploy") ||
    (messages.includes("after code changes") && (messages.includes("az webapp deploy") || messages.includes("az acr build"))) ||
    messages.includes("deploy again") || messages.includes("push code");
  if (!hasRedeployCommand) {
    agentMetadata.testComments.push("⚠️ HANDOFF: No redeploy command provided — handoff-protocol.md requires a redeploy shortcut for code changes");
  }
  const hasRecommendations =
    messages.includes("next step") || messages.includes("recommend") ||
    messages.includes("consider") || messages.includes("post-deploy") ||
    messages.includes("you should") || messages.includes("suggestion");
  if (!hasRecommendations) {
    agentMetadata.testComments.push("❌ HANDOFF: No post-deploy recommendations — handoff must include next-step recommendations");
  }
  // Hard: at least 3 of 4 handoff elements must be present (identity, cleanup, redeploy, recommendations)
  const handoffScore = [hasDeployIdentity, hasCleanup, hasRedeployCommand, hasRecommendations].filter(Boolean).length;
  if (handoffScore < 3) {
    agentMetadata.testComments.push(`❌ HANDOFF: Only ${handoffScore}/4 elements present — need at least 3 (identity, cleanup, redeploy, recommendations)`);
  }
  expect(handoffScore).toBeGreaterThanOrEqual(3);
}

/**
 * Validate deploy-result.json schema.
 */
export function assertDeployResultSchema(agentMetadata: AgentMetadata, workspacePath: string): void {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("❌ DEPLOY RESULT: .copilot-azure/sessions/ not found");
    expect(fs.existsSync(sessionDir)).toBe(true);
    return;
  }
  const folders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  let found = false;
  for (const folder of folders) {
    const resultPath = path.join(sessionDir, folder, "deploy-result.json");
    if (!fs.existsSync(resultPath)) continue;
    found = true;
    try {
      const result = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
      const requiredFields = ["status", "subscriptionId", "resourceGroupName", "sessionId"];
      const missing = requiredFields.filter(f => result[f] === undefined);
      if (missing.length > 0) {
        agentMetadata.testComments.push(`❌ DEPLOY RESULT: Missing required fields: ${missing.join(", ")}`);
        expect(missing.length).toBe(0);
      } else {
        agentMetadata.testComments.push(`✅ DEPLOY RESULT: status=${result.status}, rg=${result.resourceGroupName}`);
      }
      // deploy-schemas.ts: DeployResult requires endpoints[], healthStatus, deploymentNames[]
      const expectedArrayFields = ["endpoints", "deploymentNames", "resourceIds"];
      for (const field of expectedArrayFields) {
        if (result[field] !== undefined && !Array.isArray(result[field])) {
          agentMetadata.testComments.push(`❌ DEPLOY RESULT: ${field} is not an array`);
        } else if (result[field] === undefined) {
          agentMetadata.testComments.push(`⚠️ DEPLOY RESULT: ${field} missing — deploy-schemas.ts requires it`);
        }
      }
      // deploy-schemas.ts: healthStatus must be one of "healthy" | "degraded" | "unreachable" | "unknown"
      if (result.healthStatus) {
        const validStatuses = ["healthy", "degraded", "unreachable", "unknown"];
        if (!validStatuses.includes(result.healthStatus)) {
          agentMetadata.testComments.push(`❌ DEPLOY RESULT: healthStatus '${result.healthStatus}' not valid — must be one of ${validStatuses.join(", ")}`);
        }
      } else {
        agentMetadata.testComments.push("⚠️ DEPLOY RESULT: healthStatus missing — deploy-schemas.ts requires it");
      }
      if (result.healingAttempts && !Array.isArray(result.healingAttempts)) {
        agentMetadata.testComments.push("❌ DEPLOY RESULT: healingAttempts is not an array");
        expect(Array.isArray(result.healingAttempts)).toBe(true);
      }
      return;
    } catch {
      agentMetadata.testComments.push("❌ DEPLOY RESULT: Failed to parse deploy-result.json");
      expect(false).toBe(true);
    }
  }
  if (!found) {
    agentMetadata.testComments.push("❌ DEPLOY RESULT: deploy-result.json not found — deploy-result.json must always be written regardless of outcome");
    expect(found).toBe(true);
  }
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
          messages.includes("should i continue") || messages.includes("alternative") ||
          messages.includes("what would you") || messages.includes("should i");
        if (!pausedForUser) {
          agentMetadata.testComments.push(
            `❌ HEALING LOOP: ${attempts.length} attempts without pausing for user (must pause after 3 consecutive failures)`,
          );
        } else {
          agentMetadata.testComments.push(`✅ HEALING LOOP: Paused for user after ${attempts.length} attempts`);
        }
        expect(pausedForUser).toBe(true);
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
 * Checks that at least one file-reading tool was invoked.
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
 * Catches agents that jump to "here's your architecture plan" without completing evaluation.
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

// ═══════════════════════════════════════════════════════════════════════════
// Deploy Safety Assertions (audit gap coverage)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assert the agent read pipeline-rules.md during the session.
 *
 * Checks two sources (per analyze-run-lessons.md):
 * 1. Tool calls: read_file/view/fetch where arguments contain "pipeline-rules"
 * 2. Tool text: sub-agent reads appear as text in task completion output,
 *    not as view blocks — search getAllToolText() for content fragments.
 *
 * Hard assertion — pipeline-rules.md must be read at session start and after context compaction.
 */
export function assertPipelineRulesRead(agentMetadata: AgentMetadata): void {
  const toolCalls = getToolCalls(agentMetadata);

  // Source 1: direct tool call reading pipeline-rules.md
  const readToolNames = ["read_file", "view", "fetch", "view_file"];
  const readViaTool = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (!readToolNames.includes(toolName)) return false;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("pipeline-rules");
  });

  // Source 2: sub-agent reads show up as text in tool output (task completion)
  const toolText = getAllToolText(agentMetadata).toLowerCase();
  const readViaSubAgent = toolText.includes("pipeline-rules.md") ||
    toolText.includes("pipeline rules") ||
    // Content fragments from pipeline-rules.md that prove it was read:
    toolText.includes("two separate approval gates are required") ||
    toolText.includes("before executing the first command of any new phase");

  // Source 3: assistant messages referencing pipeline-rules content
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const referencedInMessages = messages.includes("pipeline-rules.md") ||
    messages.includes("pipeline rules");

  const wasRead = readViaTool || readViaSubAgent || referencedInMessages;

  if (!wasRead) {
    agentMetadata.testComments.push(
      "❌ PIPELINE RULES: Agent did not read pipeline-rules.md — must be read at session start and after compaction",
    );
  } else {
    const source = readViaTool ? "tool call" : readViaSubAgent ? "sub-agent text" : "assistant message";
    agentMetadata.testComments.push(`✅ PIPELINE RULES: pipeline-rules.md read detected via ${source}`);
  }
  expect(wasRead).toBe(true);
}

/**
 * Assert preflight checks execute in correct order before deployment.
 *
 * Validates the sequence mandated by preflight-checks.md:
 *   auth (az account show) → what-if (az deployment sub what-if) → deploy (az deployment sub create)
 *
 * If no deploy command is found (early termination), logs a soft warning and skips.
 * Hard assertion when a deploy command IS found.
 */
export function assertPreflightBeforeDeployment(agentMetadata: AgentMetadata): void {
  const toolCalls = getToolCalls(agentMetadata);

  const isShellCmd = (tc: { data: { toolName: string } }): boolean => {
    const tn = (tc.data.toolName ?? "").toLowerCase();
    return tn === "powershell" || tn === "bash" || tn === "run_in_terminal" || tn === "run_command";
  };
  const getCmd = (tc: { data: { arguments?: unknown } }): string =>
    ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();

  // Find indices of key commands
  let authIdx = -1;
  let whatIfIdx = -1;
  let deployIdx = -1;

  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    if (!isShellCmd(tc)) continue;
    const cmd = getCmd(tc);

    if (authIdx === -1 && cmd.includes("az account show")) {
      authIdx = i;
    }
    if (whatIfIdx === -1 && (cmd.includes("what-if") || cmd.includes("terraform plan"))) {
      whatIfIdx = i;
    }
    // Deployment command — exclude what-if variants
    if (deployIdx === -1 &&
      (cmd.includes("az deployment sub create") || cmd.includes("az deployment group create")) &&
      !cmd.includes("what-if") && !cmd.includes("--what-if")) {
      deployIdx = i;
    }
    if (deployIdx === -1 && cmd.includes("terraform apply")) {
      deployIdx = i;
    }
  }

  if (deployIdx === -1) {
    agentMetadata.testComments.push(
      "⚠️ PREFLIGHT ORDER: No deploy command found in tool calls — agent may not have reached deploy phase. Skipping ordering assertion.",
    );
    return;
  }

  // Auth must precede deploy
  if (authIdx !== -1) {
    if (authIdx < deployIdx) {
      agentMetadata.testComments.push(`✅ PREFLIGHT ORDER: az account show (idx=${authIdx}) before deploy (idx=${deployIdx})`);
    } else {
      agentMetadata.testComments.push(
        `❌ PREFLIGHT ORDER: az account show (idx=${authIdx}) AFTER deploy (idx=${deployIdx}) — preflight-checks.md requires auth before deploy`,
      );
    }
    expect(authIdx).toBeLessThan(deployIdx);
  } else {
    agentMetadata.testComments.push("⚠️ PREFLIGHT ORDER: az account show not found — may be implicit or missed");
  }

  // What-if must precede deploy
  if (whatIfIdx !== -1) {
    if (whatIfIdx < deployIdx) {
      agentMetadata.testComments.push(`✅ PREFLIGHT ORDER: what-if (idx=${whatIfIdx}) before deploy (idx=${deployIdx})`);
    } else {
      agentMetadata.testComments.push(
        `❌ PREFLIGHT ORDER: what-if (idx=${whatIfIdx}) AFTER deploy (idx=${deployIdx}) — preflight-checks.md requires preview before deploy`,
      );
    }
    expect(whatIfIdx).toBeLessThan(deployIdx);
  } else {
    agentMetadata.testComments.push(
      "❌ PREFLIGHT ORDER: No what-if/terraform plan found — preflight-checks.md MANDATORY step skipped",
    );
    expect(whatIfIdx).not.toBe(-1);
  }
}

/**
 * Assert portal monitoring link was generated before deployment.
 *
 * Checks two sources (per portal-links.md and analyze-run-lessons.md):
 * 1. PowerShell output: LINK=https://portal.azure.com in tool text
 * 2. Assistant messages: bare URL with DeploymentDetailsBlade
 *
 * Hard assertion — portal-links.md requires link BEFORE deployment.
 */
export function assertPortalLinkGenerated(agentMetadata: AgentMetadata): void {
  const messages = getAllAssistantMessages(agentMetadata);
  const toolText = getAllToolText(agentMetadata);
  const toolCalls = getToolCalls(agentMetadata);

  // The agent generates portal deployment links in two URL formats:
  //   Old: ...#blade/Microsoft_Azure_Resources/DeploymentDetailsBlade/...
  //   New: ...#view/Microsoft_Azure_Resources/DeploymentDetails.MenuView/...
  // And outputs them with different variable prefixes: LINK= or PORTAL=
  const portalDeployPattern = /DeploymentDetailsBlade|DeploymentDetails\.MenuView/i;

  // Check for portal link in assistant messages
  const portalLinkInMessages = /portal\.azure\.com/.test(messages) && portalDeployPattern.test(messages);

  // Check for LINK= or PORTAL= in PowerShell output (tool text — result.content from tool.execution_complete)
  const linkInToolOutput = /(LINK|PORTAL)=https:\/\/portal\.azure\.com/i.test(toolText)
    || (/portal\.azure\.com/.test(toolText) && portalDeployPattern.test(toolText));

  // Check for portal link in shell command args (the Write-Output "LINK=$l" pattern with DeploymentDetails)
  const linkInShellArgs = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "powershell" && toolName !== "bash" && toolName !== "run_in_terminal") return false;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "");
    return portalDeployPattern.test(cmd) || /(LINK|PORTAL)=.*portal\.azure\.com/i.test(cmd);
  });

  const hasPortalLink = portalLinkInMessages || linkInToolOutput || linkInShellArgs;

  if (!hasPortalLink) {
    agentMetadata.testComments.push(
      "❌ PORTAL LINK: No deployment portal URL found in messages or tool output — portal-links.md requires link BEFORE deployment",
    );
  } else {
    const source = portalLinkInMessages ? "assistant message" : linkInToolOutput ? "tool output" : "shell command";
    agentMetadata.testComments.push(`✅ PORTAL LINK: Deployment portal URL detected via ${source}`);
  }
  expect(hasPortalLink).toBe(true);
}

/**
 * Assert SCM basic auth was re-disabled after health checks.
 *
 * Checks for az rest --method PUT to basicPublishingCredentialsPolicies/scm.
 * Gracefully skips for Container Apps targets (no SCM endpoint).
 *
 * Hard assertion for App Service targets — SCM basic auth must be re-disabled after code upload.
 */
export function assertScmBasicAuthDisabled(agentMetadata: AgentMetadata): void {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const toolCalls = getToolCalls(agentMetadata);

  // Check if agent used Container Apps — SCM is App Service-only
  const isContainerApps = /container\s*app/i.test(messages) && !/app\s*service/i.test(messages);
  if (isContainerApps) {
    agentMetadata.testComments.push("ℹ️ SCM RE-DISABLE: Container Apps target — SCM not applicable, skipping assertion");
    return;
  }

  const isShellCmd = (tc: { data: { toolName: string } }): boolean => {
    const tn = (tc.data.toolName ?? "").toLowerCase();
    return tn === "powershell" || tn === "bash" || tn === "run_in_terminal" || tn === "run_command";
  };
  const getCmd = (tc: { data: { arguments?: unknown } }): string =>
    ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();

  // Find ALL SCM PUT calls — expect 2: enable (allow:true) then disable (allow:false)
  // Also track SCM GET verification calls — deploy SKILL.md Step 7 requires GET after PUT to verify allow=false
  const scmPutCalls: { idx: number; isEnable: boolean }[] = [];
  const scmGetCalls: number[] = [];
  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    if (!isShellCmd(tc)) continue;
    const cmd = getCmd(tc);
    const isScmPut = (cmd.includes("basicpublishingcredentialpolicies/scm") && (cmd.includes("put") || cmd.includes("--method put")))
      || (cmd.includes("publishing") && cmd.includes("scm") && (cmd.includes("true") || cmd.includes("false")) && cmd.includes("put"));
    if (isScmPut) {
      const isEnable = cmd.includes("true") || cmd.includes("allow\":true") || cmd.includes("allow\": true");
      scmPutCalls.push({ idx: i, isEnable });
      continue;
    }
    // SCM GET verification — deploy SKILL.md Step 7 requires GET after disable to verify allow=false
    const isScmGet = cmd.includes("basicpublishingcredentialpolicies/scm") && (cmd.includes("get") || cmd.includes("--method get"));
    if (isScmGet) {
      scmGetCalls.push(i);
    }
  }

  if (scmPutCalls.length === 0) {
    // Check: Was SCM managed declaratively via Bicep resource? (superior — no enable window)
    const hasDeclarativeScm = toolCalls.some(tc => {
      const tn = (tc.data.toolName ?? "").toLowerCase();
      if (tn !== "create" && tn !== "create_file" && tn !== "edit") return false;
      const content = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
      return content.includes("basicpublishingcredentialpolicies");
    });

    // Also check sub-agent output (IaC review sub-agents report on SCM resources)
    const scmInSubagent = toolCalls.some(tc => {
      const tn = (tc.data.toolName ?? "").toLowerCase();
      if (tn !== "read_agent") return false;
      const result = JSON.stringify(tc.data).toLowerCase();
      return result.includes("basicpublishingcredentialpolicies");
    });

    if (hasDeclarativeScm || scmInSubagent) {
      agentMetadata.testComments.push(
        "ℹ️ SCM LIFECYCLE: Managed declaratively via Bicep (allow:false at provision time — superior to imperative enable/disable cycle)",
      );
      return;
    }

    agentMetadata.testComments.push(
      "❌ SCM LIFECYCLE: No basicPublishingCredentialsPolicies/scm management found — neither imperative PUT nor declarative Bicep resource",
    );
    expect(scmPutCalls.length).toBeGreaterThan(0);
    return;
  }

  // Log all SCM calls found
  agentMetadata.testComments.push(
    `ℹ️ SCM LIFECYCLE: Found ${scmPutCalls.length} SCM PUT call(s): ${scmPutCalls.map(c => `idx=${c.idx} ${c.isEnable ? "ENABLE" : "DISABLE"}`).join(", ")}`,
  );

  // Find the disable call (last non-enable SCM PUT)
  const disableCall = [...scmPutCalls].reverse().find(c => !c.isEnable);
  if (!disableCall) {
    agentMetadata.testComments.push(
      "❌ SCM RE-DISABLE: SCM was enabled but never re-disabled (no allow:false PUT found)",
    );
    expect(disableCall).toBeDefined();
    return;
  }

  // Verify ordering: SCM disable should come after health-check-related activity
  let lastHealthCheckIdx = -1;
  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    if (!isShellCmd(tc)) continue;
    const cmd = getCmd(tc);
    if (cmd.includes("curl") || cmd.includes("invoke-webrequest") || cmd.includes("invoke-restmethod") ||
      cmd.includes("/health") || (cmd.includes("az webapp show") && i < disableCall.idx)) {
      lastHealthCheckIdx = i;
    }
  }

  if (lastHealthCheckIdx !== -1 && disableCall.idx > lastHealthCheckIdx) {
    agentMetadata.testComments.push(
      `✅ SCM RE-DISABLE: disable PUT (idx=${disableCall.idx}) after health check (idx=${lastHealthCheckIdx}) — correct ordering`,
    );
  } else if (lastHealthCheckIdx === -1) {
    agentMetadata.testComments.push(
      "⚠️ SCM RE-DISABLE: SCM disabled but no explicit health check command detected — ordering unverifiable",
    );
  } else {
    agentMetadata.testComments.push(
      `⚠️ SCM RE-DISABLE: disable PUT (idx=${disableCall.idx}) before health check (idx=${lastHealthCheckIdx}) — may be misordered`,
    );
  }

  // deploy SKILL.md Step 7: after disable PUT, MUST verify via GET that allow=false
  const getAfterDisable = scmGetCalls.filter(idx => idx > disableCall.idx);
  if (getAfterDisable.length > 0) {
    agentMetadata.testComments.push(
      `✅ SCM VERIFY: GET verification (idx=${getAfterDisable[0]}) after disable PUT (idx=${disableCall.idx})`,
    );
  } else {
    agentMetadata.testComments.push(
      "⚠️ SCM VERIFY: No GET verification after disable PUT — deploy SKILL.md Step 7 requires GET to confirm allow=false",
    );
  }
}

/**
 * Assert generated Bicep files include the app-onboard-skill tag.
 *
 * Checks two sources:
 * 1. Actual .bicep files in the workspace infra/ directory
 * 2. Fallback: create_file/write_file tool call content for .bicep files
 *
 * Also verifies the tag value is literal 'true' (not parameterized).
 *
 * Hard assertion — pipeline-rules.md security baseline requires this tag.
 */
export function assertBicepTagPresent(agentMetadata: AgentMetadata, workspacePath: string): void {
  // Source 1: check actual .bicep files on disk
  const infraDir = path.join(workspacePath, "infra");
  const bicepFiles: { path: string; content: string }[] = [];
  if (fs.existsSync(infraDir)) {
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith(".bicep")) {
          try {
            bicepFiles.push({ path: full, content: fs.readFileSync(full, "utf-8") });
          } catch { /* skip unreadable files */ }
        }
      }
    };
    walk(infraDir);
  }

  // Check .bicep files for the tag
  let foundInFile = false;
  let tagIsLiteral = false;
  for (const bf of bicepFiles) {
    if (bf.content.includes("app-onboard-skill")) {
      foundInFile = true;
      // Check for literal 'true' value (not parameterized)
      if (/app-onboard-skill.*['"]true['"]/i.test(bf.content) || /['"]app-onboard-skill['"].*['"]true['"]/i.test(bf.content)) {
        tagIsLiteral = true;
      }
      break;
    }
  }

  // Source 2: fallback — check tool call content
  let foundInToolCall = false;
  if (!foundInFile) {
    const toolCalls = getToolCalls(agentMetadata);
    for (const tc of toolCalls) {
      const toolName = (tc.data.toolName ?? "").toLowerCase();
      if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") continue;
      const args = tc.data.arguments as Record<string, unknown> ?? {};
      const filePath = (args.path as string ?? args.file_path as string ?? args.filePath as string ?? "").toLowerCase();
      if (!filePath.endsWith(".bicep")) continue;
      const content = (args.content as string ?? args.file_text as string ?? "");
      if (content.includes("app-onboard-skill")) {
        foundInToolCall = true;
        if (/app-onboard-skill.*['"]true['"]/i.test(content) || /['"]app-onboard-skill['"].*['"]true['"]/i.test(content)) {
          tagIsLiteral = true;
        }
        break;
      }
    }
  }

  const tagFound = foundInFile || foundInToolCall;

  if (!tagFound) {
    agentMetadata.testComments.push(
      "❌ BICEP TAG: 'app-onboard-skill' tag not found in any .bicep file — pipeline-rules.md requires this tag. " +
      `Checked ${bicepFiles.length} file(s) on disk + tool call content.`,
    );
  } else {
    const source = foundInFile ? "file on disk" : "tool call content";
    agentMetadata.testComments.push(`✅ BICEP TAG: 'app-onboard-skill' tag found in ${source}`);
    if (!tagIsLiteral) {
      agentMetadata.testComments.push(
        "⚠️ BICEP TAG: Tag value may be parameterized — expected literal 'true' (not uniqueString() or variable reference)",
      );
    } else {
      agentMetadata.testComments.push("✅ BICEP TAG: Tag value is literal 'true'");
    }
  }
  expect(tagFound).toBe(true);
}

/**
 * Early terminate once deploy completes AND post-deploy steps are observed.
 *
 * Use for tests that need to observe post-deploy behavior (SCM re-disable, handoff).
 * Fires when deploy-result.json is written AND at least one of:
 *   (a) Handoff content detected (cleanup commands, deployment identity)
 *   (b) SCM re-disable command detected
 *   (c) Agent presents post-deploy recommendations
 */
export function shouldEarlyTerminateOnDeployComplete(metadata: AgentMetadata): boolean {
  return withRoutingBailout((m) => {
    const toolCalls = getToolCalls(m);
    const fileWriteTools = ["create_file", "write_file", "create", "edit", "replace_string_in_file"];

    // Gate 1: deploy-result.json must be written/updated (not just mentioned in another file's content)
    // Check the file path argument specifically — not the entire stringified args blob,
    // which can contain "deploy-result" in the content of other files (e.g., deploy-checklist.md).
    const deployResultIdx = toolCalls.findIndex(tc => {
      const toolName = (tc.data.toolName ?? "").toLowerCase();
      if (!fileWriteTools.includes(toolName)) return false;
      const argsObj = (tc.data.arguments ?? {}) as Record<string, unknown>;
      const filePath = ((argsObj.path ?? argsObj.filePath ?? "") as string).toLowerCase();
      return filePath.includes("deploy-result");
    });

    if (deployResultIdx >= 0) {
      // Gate 2: context.json updated after deploy-result.json — the authoritative
      // signal that the deploy phase is complete and the agent has finalized artifacts.
      const hasContextUpdate = toolCalls.slice(deployResultIdx).some(tc => {
        const tn = (tc.data.toolName ?? "").toLowerCase();
        if (!fileWriteTools.includes(tn)) return false;
        const argsObj = (tc.data.arguments ?? {}) as Record<string, unknown>;
        const fp = ((argsObj.path ?? argsObj.filePath ?? "") as string).toLowerCase();
        return fp.includes("context.json");
      });

      if (hasContextUpdate) {
        m.testComments.push("✅ EARLY TERMINATE: deploy-result.json written + context.json updated.");
        return true;
      }

      // Fallback: if deploy-result.json was written but context.json was never updated
      // after 5+ additional tool calls, terminate anyway — the agent finalized deploy
      // but may have skipped the context.json update.
      if (toolCalls.length - deployResultIdx > 5) {
        m.testComments.push("⚠️ EARLY TERMINATE (fallback): deploy-result.json written but no context.json update after 5 tool calls.");
        return true;
      }
    }

    // Fallback 2: if the agent has run 2+ actual deployment commands (az deployment sub/group create),
    // it has attempted deploy + at least one healing retry. We've captured enough deploy behavior
    // for all assertions. Without this, seeded-fixture tests can loop for 60min in healing.
    const shellTools = ["powershell", "bash", "run_in_terminal", "run_command"];
    const deployCommandCount = toolCalls.filter(tc => {
      const tn = (tc.data.toolName ?? "").toLowerCase();
      if (!shellTools.includes(tn)) return false;
      const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
      return (cmd.includes("az deployment sub create") || cmd.includes("az deployment group create")) &&
        !cmd.includes("what-if");
    }).length;

    if (deployCommandCount >= 2) {
      m.testComments.push(`⚠️ EARLY TERMINATE (deploy-count fallback): ${deployCommandCount} az deployment commands executed — enough deploy behavior captured.`);
      return true;
    }

    return false;
  })(metadata);
}

/**
 * Early terminate when the FULL pipeline is definitively done.
 *
 * Signal: `context.json` write/edit containing BOTH `"deploy"` in completedPhases
 * AND `currentPhase: null`. This is the single authoritative "pipeline done" marker —
 * deploy/SKILL.md Step 8 explicitly sets these values as its last action before
 * returning to the orchestrator for handoff (Step 10).
 *
 * Why this is better than existing terminators:
 * - No fuzzy chat text matching (unlike shouldEarlyTerminateOnHandoff)
 * - Won't false-fire during healing (unlike the 2-deploy-command fallback)
 * - Won't fire on intermediate context.json writes (Step 1 create doesn't have these values)
 * - Single artifact check — deterministic
 *
 * Use for tests that need to observe the full pipeline through deploy completion
 * but don't need to wait for the handoff chat message.
 */
export function shouldEarlyTerminateOnPipelineComplete(metadata: AgentMetadata): boolean {
  return withRoutingBailout((m) => {
    const toolCalls = getToolCalls(m);
    const fileWriteTools = ["create_file", "write_file", "create", "edit", "replace_string_in_file"];

    // Find context.json write with currentPhase: null + "deploy" in completedPhases
    const pipelineDoneEvent = toolCalls.find(tc => {
      const tn = (tc.data.toolName ?? "").toLowerCase();
      if (!fileWriteTools.includes(tn)) return false;
      const args = tc.data.arguments as Record<string, unknown> ?? {};
      const filePath = ((args.path ?? args.filePath ?? "") as string).toLowerCase();
      if (!filePath.includes("context.json")) return false;
      const content = JSON.stringify(args).toLowerCase();
      // Must have "deploy" in completedPhases AND currentPhase set to null
      const hasDeployPhase = content.includes('"deploy"');
      const hasNullPhase = content.includes('"currentphase": null') ||
        content.includes('"currentphase":null') ||
        content.includes('"currentphase": "null"');
      return hasDeployPhase && hasNullPhase;
    });

    if (!pipelineDoneEvent) return false;

    // Wait for assistant message after the write (ensures artifacts are on disk)
    const hasAssistantAfter = m.events.some(
      e => (e.type === "assistant.message" || e.type === "assistant.message_delta")
        && e.timestamp > pipelineDoneEvent.timestamp,
    );

    if (hasAssistantAfter) {
      m.testComments.push(
        "✅ EARLY TERMINATE: context.json updated with completedPhases=[\"deploy\"] + currentPhase=null — pipeline complete.",
      );
    }
    return hasAssistantAfter;
  })(metadata);
}

// ─────────────────────────────────────────────────────────────────
// Sub-agent delegation assertions
//
// Skills mandate sub-agent dispatch via `task` tool for critical steps.
// The SDK emits two signals when a `task` tool call fires:
//   1. tool.execution_start with toolName === "task"  (primary — the tool call itself)
//   2. subagent.started / subagent.completed          (secondary — SDK lifecycle events)
// These helpers check BOTH (OR) so assertions pass regardless of which
// signal the SDK version emits.
// ─────────────────────────────────────────────────────────────────

/**
 * Check if the `task` tool was invoked during the run.
 * Primary signal: tool.execution_start where toolName === "task".
 */
export function isTaskToolDispatched(agentMetadata: AgentMetadata): boolean {
  return getToolCalls(agentMetadata).some(tc =>
    (tc.data.toolName ?? "").toLowerCase() === "task"
  );
}

/**
 * Count how many `task` tool calls were made.
 */
export function getTaskToolCount(agentMetadata: AgentMetadata): number {
  return getToolCalls(agentMetadata).filter(tc =>
    (tc.data.toolName ?? "").toLowerCase() === "task"
  ).length;
}

/**
 * Check if any sub-agent was dispatched during the run.
 * Checks BOTH `task` tool calls AND `subagent.started` events.
 */
export function isSubagentDispatched(agentMetadata: AgentMetadata): boolean {
  return isTaskToolDispatched(agentMetadata) ||
    agentMetadata.events.some(e => e.type === "subagent.started");
}

/**
 * Count sub-agent dispatches (max of task tool calls vs subagent.started events).
 */
export function getSubagentCount(agentMetadata: AgentMetadata): number {
  const taskCount = getTaskToolCount(agentMetadata);
  const eventCount = agentMetadata.events.filter(e => e.type === "subagent.started").length;
  return Math.max(taskCount, eventCount);
}

/**
 * Check if any sub-agent failed (via subagent.failed event OR task tool completion failure).
 */
export function hasSubagentFailure(agentMetadata: AgentMetadata): boolean {
  // Check subagent.failed events
  if (agentMetadata.events.some(e => e.type === "subagent.failed")) return true;
  // Check task tool completion failures
  const taskToolCallIds = new Set(
    getToolCalls(agentMetadata)
      .filter(tc => (tc.data.toolName ?? "").toLowerCase() === "task")
      .map(tc => tc.data.toolCallId as string)
  );
  return agentMetadata.events.some(e =>
    e.type === "tool.execution_complete" &&
    taskToolCallIds.has(e.data.toolCallId as string) &&
    !e.data.success
  );
}

/**
 * Detect whether a specific subagent template file was read via view/read_file.
 */
function wasSubagentTemplateRead(agentMetadata: AgentMetadata, templateFilename: string): boolean {
  const toolCalls = getToolCalls(agentMetadata);
  const readToolNames = ["read_file", "view", "view_file", "fetch"];
  return toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (!readToolNames.includes(toolName)) return false;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes(templateFilename.toLowerCase());
  });
}

/**
 * Check if any `task` tool call's arguments mention a specific template by name.
 * The main agent may paste template content directly into the `task` prompt without
 * making a separate `view` call for the template file.
 */
function wasTaskDispatchedForTemplate(agentMetadata: AgentMetadata, templateKeyword: string): boolean {
  const keyword = templateKeyword.toLowerCase();
  return getToolCalls(agentMetadata)
    .filter(tc => (tc.data.toolName ?? "").toLowerCase() === "task")
    .some(tc => {
      const args = tc.data.arguments as Record<string, unknown> | undefined;
      if (!args) return false;
      const description = ((args.description ?? "") as string).toLowerCase();
      const prompt = ((args.prompt ?? "") as string).toLowerCase();
      const name = ((args.name ?? "") as string).toLowerCase();
      return description.includes(keyword) || prompt.includes(keyword) || name.includes(keyword);
    });
}

/**
 * Check if the agent reached the deploy phase.
 * Evidence: powershell with `az deployment`, deploy-checklist written/read,
 * deploy-result written, or deploy-schemas.ts read.
 */
export function hasReachedDeployPhase(agentMetadata: AgentMetadata): boolean {
  const toolCalls = getToolCalls(agentMetadata);

  // Check for az deployment commands
  const hasDeployCommand = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "powershell" && toolName !== "bash" && toolName !== "run_in_terminal") return false;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    return cmd.includes("az deployment");
  });

  // Check for deploy-checklist.md written or read
  const hasChecklist = toolCalls.some(tc => {
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("deploy-checklist");
  });

  // Check for deploy-result.json written
  // Check file path specifically — not the entire stringified args blob
  const hasDeployResult = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "create" && toolName !== "create_file" && toolName !== "write_file") return false;
    const argsObj = (tc.data.arguments ?? {}) as Record<string, unknown>;
    const filePath = ((argsObj.path ?? argsObj.filePath ?? "") as string).toLowerCase();
    return filePath.includes("deploy-result");
  });

  // Check for deploy-schemas.ts read (agent entered deploy phase and started reading deploy refs)
  const hasDeploySchemas = wasSubagentTemplateRead(agentMetadata, "deploy-schemas");

  // Check for subagent-preflight.md read (deploy Step 0)
  const hasPreflightTemplate = wasSubagentTemplateRead(agentMetadata, "subagent-preflight");

  return hasDeployCommand || hasChecklist || hasDeployResult || hasDeploySchemas || hasPreflightTemplate;
}

/**
 * Check if the agent reached the scaffold phase.
 * Evidence: scaffold/SKILL.md read, subagent-iac-gen.md read, .bicep files written,
 * or scaffold-manifest.json written.
 */
export function hasReachedScaffoldPhase(agentMetadata: AgentMetadata): boolean {
  const scaffoldSkillRead = wasSubagentTemplateRead(agentMetadata, "scaffold/SKILL");
  const iacGenRead = wasSubagentTemplateRead(agentMetadata, "subagent-iac-gen");

  const toolCalls = getToolCalls(agentMetadata);

  const hasBicepWrite = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "create" && toolName !== "create_file" && toolName !== "write_file") return false;
    const argsObj = tc.data.arguments as Record<string, unknown> | undefined;
    const filePath = ((argsObj?.path ?? argsObj?.filePath ?? "") as string).toLowerCase();
    return filePath.endsWith(".bicep") || filePath.endsWith(".tf");
  });

  const hasScaffoldManifest = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "create" && toolName !== "create_file" && toolName !== "write_file") return false;
    const argsObj = tc.data.arguments as Record<string, unknown> | undefined;
    const filePath = ((argsObj?.path ?? argsObj?.filePath ?? "") as string).toLowerCase();
    return filePath.includes("scaffold-manifest");
  });

  return scaffoldSkillRead || iacGenRead || hasBicepWrite || hasScaffoldManifest;
}

/**
 * HARD ASSERTION — Scaffold phase MUST dispatch sub-agents for IaC generation,
 * self-review, and validation.
 *
 * Sub-agent delegation is mandatory for scaffold IaC generation, review, and validation.
 * Checks: `task` tool call OR `subagent.started` event, AND template evidence
 * (read via view, OR pasted into task args).
 */
export function assertScaffoldSubagentsDispatched(agentMetadata: AgentMetadata): void {
  const taskCount = getTaskToolCount(agentMetadata);
  const subagentEventCount = agentMetadata.events.filter(e => e.type === "subagent.started").length;
  const dispatched = taskCount >= 1 || subagentEventCount >= 1;

  const iacGenRead = wasSubagentTemplateRead(agentMetadata, "subagent-iac-gen");
  const iacGenInTaskArgs = wasTaskDispatchedForTemplate(agentMetadata, "iac-gen");
  const reviewRead = wasSubagentTemplateRead(agentMetadata, "subagent-review");
  const validateRead = wasSubagentTemplateRead(agentMetadata, "subagent-validate");

  const hasIacGenEvidence = iacGenRead || iacGenInTaskArgs;
  const passed = dispatched && hasIacGenEvidence;

  if (!passed) {
    agentMetadata.testComments.push(
      `❌ SCAFFOLD SUB-AGENTS: Expected ≥1 task/subagent dispatch with iac-gen evidence. task calls: ${taskCount}, subagent.started: ${subagentEventCount}. iac-gen read: ${iacGenRead}, iac-gen in task args: ${iacGenInTaskArgs}. review: ${reviewRead}, validate: ${validateRead}. Sub-agent delegation is mandatory for scaffold IaC generation, review, and validation.`,
    );
  } else {
    agentMetadata.testComments.push(
      `✅ SCAFFOLD SUB-AGENTS: Dispatched (task: ${taskCount}, subagent.started: ${subagentEventCount}). iac-gen: ${iacGenRead || iacGenInTaskArgs}, review: ${reviewRead}, validate: ${validateRead}`,
    );
  }
  expect(passed).toBe(true);
}

/**
 * ROOT CAUSE GUARD — Check if deploy-checklist.md exists on disk.
 *
 * Call this BEFORE downstream deploy assertions (portal link, SCM, handoff,
 * deploy-result schema). If missing, the preflight sub-agent wasn't dispatched
 * and all downstream checks will cascade-fail from the same root cause.
 *
 * Returns true if checklist exists, false otherwise. Adds diagnostic comment.
 */
/**
 * SOFT CHECK — Report on the incremental deploy-audit.log the deploy phase writes.
 *
 * deploy/SKILL.md and deploy-checklist-template.md require appending audit lines
 * around each deploy command, in the form:
 *   {timestamp} | {command} | started
 *   {timestamp} | {command} | succeeded|failed
 * (On retry the generated password is reused from this log rather than regenerated.)
 *
 * Informational only (pushes testComments, never fails) — restored from the
 * implementation removed in an earlier refactor while integration-depth.test.ts
 * still imported/called it.
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

export function assertDeployChecklistExists(agentMetadata: AgentMetadata, workspacePath: string): boolean {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("⚠️ DEPLOY CHECKLIST GUARD: .copilot-azure/sessions/ not found — deploy phase may not have started");
    return false;
  }
  const folders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());
  for (const folder of folders) {
    const checklistPath = path.join(sessionDir, folder, "deploy-checklist.md");
    if (fs.existsSync(checklistPath)) {
      const content = fs.readFileSync(checklistPath, "utf-8");
      agentMetadata.testComments.push(`✅ DEPLOY CHECKLIST GUARD: deploy-checklist.md found (${content.length} chars) — preflight sub-agent ran`);
      return true;
    }
  }
  agentMetadata.testComments.push(
    "❌ DEPLOY CHECKLIST GUARD: deploy-checklist.md NOT found on disk — preflight sub-agent was NOT dispatched. " +
    "This is the ROOT CAUSE of downstream failures (portal link, SCM re-disable, handoff, deploy-result). " +
    "Fix: ensure deploy/SKILL.md Step 0 dispatches subagent-preflight.md as a task.",
  );
  return false;
}

/**
 * HARD ASSERTION — Deploy phase MUST dispatch the preflight sub-agent first.
 *
 * The preflight sub-agent must be dispatched before any other deploy action.
 *
 * Checks: (`task` tool call OR `subagent.started`) AND (template read OR deploy-checklist.md written).
 */
export function assertDeployPreflightSubagentDispatched(agentMetadata: AgentMetadata): void {
  const taskCount = getTaskToolCount(agentMetadata);
  const subagentEventCount = agentMetadata.events.filter(e => e.type === "subagent.started").length;
  const dispatched = taskCount >= 1 || subagentEventCount >= 1;

  const templateRead = wasSubagentTemplateRead(agentMetadata, "subagent-preflight");

  const toolCalls = getToolCalls(agentMetadata);
  const checklistWritten = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "create" && toolName !== "create_file" && toolName !== "write_file") return false;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("deploy-checklist");
  });

  const checklistRead = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "view" && toolName !== "read_file" && toolName !== "view_file") return false;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("deploy-checklist");
  });

  const passed = dispatched && (templateRead || checklistWritten);

  if (!passed) {
    agentMetadata.testComments.push(
      `❌ DEPLOY PREFLIGHT: NOT dispatched. task calls: ${taskCount}, subagent.started: ${subagentEventCount}, subagent-preflight.md read: ${templateRead}, deploy-checklist.md written: ${checklistWritten}, read back: ${checklistRead}. Preflight sub-agent must be dispatched before any other deploy action.`,
    );
  } else {
    agentMetadata.testComments.push(
      `✅ DEPLOY PREFLIGHT: Dispatched (task calls: ${taskCount}, subagent.started: ${subagentEventCount}, template read: ${templateRead}, checklist written: ${checklistWritten}, checklist read: ${checklistRead})`,
    );
    if (!checklistRead) {
      agentMetadata.testComments.push(
        "⚠️ DEPLOY PREFLIGHT: deploy-checklist.md was NOT read back after sub-agent returned — " +
        "deploy-checklist.md must be viewed immediately after the preflight sub-agent completes.",
      );
    }
  }
  expect(passed).toBe(true);
}

/**
 * HARD ASSERTION — Prepare phase MUST delegate quota validation to a sub-agent.
 *
 * Quota checks consume significant context (per-region, per-SKU API calls) and must be
 * delegated via a sub-agent. Checks: template read OR quota-related
 * evidence in tool output (az rest calls for capabilities/usages).
 */
export function assertQuotaSubagentDispatched(agentMetadata: AgentMetadata): void {
  const templateRead = wasSubagentTemplateRead(agentMetadata, "subagent-quota");
  const dispatched = isSubagentDispatched(agentMetadata);

  const toolText = getAllToolText(agentMetadata).toLowerCase();
  const hasQuotaEvidence =
    toolText.includes("capabilities") ||
    toolText.includes("quota") ||
    toolText.includes("sku-quota") ||
    toolText.includes("usages");

  const passed = templateRead || hasQuotaEvidence || dispatched;

  if (!passed) {
    agentMetadata.testComments.push(
      `❌ PREPARE QUOTA: No quota sub-agent evidence. subagent-quota.md read: ${templateRead}, dispatched: ${dispatched}, quota evidence in tools: ${hasQuotaEvidence}. Quota checks eat context — they MUST be delegated.`,
    );
  } else {
    const source = templateRead ? "template read" : hasQuotaEvidence ? "quota tool evidence" : "sub-agent dispatched";
    agentMetadata.testComments.push(
      `✅ PREPARE QUOTA: Quota delegation confirmed via ${source}`,
    );
  }
  expect(passed).toBe(true);
}

/**
 * HARD ASSERTION — Prepare phase MUST handle pricing via MCP tool OR sub-agent.
 *
 * Primary path: `mcp_azure_mcp_pricing` tool calls (inline, no sub-agent needed).
 * Fallback path: `subagent-pricing.md` template dispatched via `task`.
 * Also accepts: `task` tool call with pricing-related content in args.
 * Fails if none of these paths were taken — reference-file-only is NOT sufficient.
 */
export function assertPricingHandled(agentMetadata: AgentMetadata): void {
  const templateRead = wasSubagentTemplateRead(agentMetadata, "subagent-pricing");
  const pricingInTaskArgs = wasTaskDispatchedForTemplate(agentMetadata, "pricing");

  const toolCalls = getToolCalls(agentMetadata);
  const usedPricingMcp = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    return toolName.includes("pricing") || toolName.includes("azure_mcp_pricing") || toolName.includes("azure-pricing");
  });

  // Also accept: any tool call with "price" or "cost" in tool name (e.g., cost-calculator MCP)
  const usedCostTool = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    return toolName.includes("price") || toolName.includes("cost");
  });

  // Free-tier shortcut: pricing-guide.md says "If ALL services use free-tier SKUs →
  // write $0 cost estimate, skip to Step 7." The agent legitimately skips the pricing
  // API in this case. Accept if the agent mentions $0 or free-tier in cost context.
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
  const usedFreeTierShortcut =
    (messages.includes("$0") || messages.includes("free tier") || messages.includes("free-tier")) &&
    (messages.includes("cost") || messages.includes("pric") || messages.includes("estimat"));

  const passed = usedPricingMcp || usedCostTool || templateRead || pricingInTaskArgs || usedFreeTierShortcut;

  if (!passed) {
    agentMetadata.testComments.push(
      `❌ PREPARE PRICING: No pricing MCP call, sub-agent, or free-tier shortcut detected. MCP pricing tool: ${usedPricingMcp}, cost tool: ${usedCostTool}, subagent-pricing.md read: ${templateRead}, pricing in task args: ${pricingInTaskArgs}, free-tier shortcut: ${usedFreeTierShortcut}. Cost estimates must come from API data (or $0 free-tier shortcut).`,
    );
  } else {
    const source = usedPricingMcp ? "MCP pricing tool" : usedCostTool ? "cost/price MCP tool" : templateRead ? "pricing sub-agent template" : pricingInTaskArgs ? "task with pricing instructions" : "free-tier shortcut ($0)";
    agentMetadata.testComments.push(
      `✅ PREPARE PRICING: Pricing handled via ${source}`,
    );
  }
  expect(passed).toBe(true);
}

/**
 * HARD ASSERTION — Fail immediately if azure-deploy was invoked instead of azure-app-onboard.
 *
 * Deploy-phase tests use seeded workspaces with IaC artifacts. The router may
 * pick azure-deploy (standalone deploy skill) instead of azure-app-onboard.
 * This is always wrong for AppOnboard tests — catch it early with a clear message.
 */
export function assertNotRoutedToAzureDeploy(agentMetadata: AgentMetadata): void {
  const invokedAzureDeploy = isSkillInvoked(agentMetadata, "azure-deploy");
  if (invokedAzureDeploy) {
    agentMetadata.testComments.push(
      "❌ ROUTING: azure-deploy was invoked instead of azure-app-onboard — this is a routing failure, not a skill behavior issue",
    );
  }
  expect(invokedAzureDeploy).toBe(false);
}

/**
 * HARD ASSERTION — Verify no sub-agent failures occurred during the run.
 *
 * Checks BOTH `subagent.failed` events AND `task` tool completion failures.
 */
export function assertNoSubagentFailures(agentMetadata: AgentMetadata): void {
  // Check subagent.failed events
  const eventFailures = agentMetadata.events.filter(e => e.type === "subagent.failed");

  // Check task tool completion failures
  const taskToolCallIds = new Set(
    getToolCalls(agentMetadata)
      .filter(tc => (tc.data.toolName ?? "").toLowerCase() === "task")
      .map(tc => tc.data.toolCallId as string)
  );
  const taskFailures = agentMetadata.events.filter(e =>
    e.type === "tool.execution_complete" &&
    taskToolCallIds.has(e.data.toolCallId as string) &&
    !e.data.success
  );

  const totalFailures = eventFailures.length + taskFailures.length;

  if (totalFailures > 0) {
    const eventNames = eventFailures.map(e => e.data.agentName as string || "unknown").join(", ");
    const eventErrors = eventFailures.map(e => {
      const err = (e.data.error as string || "unknown error");
      return err.length > 100 ? err.substring(0, 100) + "…" : err;
    }).join("; ");
    const taskErrors = taskFailures.map(e => {
      const data = e.data as Record<string, unknown>;
      const errObj = data.error as { message?: string } | undefined;
      const err = errObj?.message || "task failed";
      return err.length > 100 ? err.substring(0, 100) + "…" : err;
    }).join("; ");
    agentMetadata.testComments.push(
      `❌ SUB-AGENT FAILURES: ${eventFailures.length} subagent.failed [${eventNames}]: ${eventErrors}. ${taskFailures.length} task tool failures: ${taskErrors}`,
    );
  } else {
    const taskCount = getTaskToolCount(agentMetadata);
    const eventCount = agentMetadata.events.filter(e => e.type === "subagent.completed").length;
    agentMetadata.testComments.push(
      `✅ SUB-AGENT HEALTH: ${taskCount} task calls, ${eventCount} subagent.completed, 0 failed`,
    );
  }
  expect(totalFailures).toBe(0);
}

/**
 * Assert the agent did NOT call external skills (azure-deploy, azure-validate,
 * azure-prepare, azure-cost, etc.) during the pipeline.
 * pipeline-rules.md: "NEVER call external skills — only azure-app-onboard-prereq
 * and orchestrator allowed."
 *
 * Non-fatal by default (logs warning). Set `hard = true` to fail the test.
 */
export function assertNoExternalSkillCalls(agentMetadata: AgentMetadata, hard = false): void {
  const toolCalls = getToolCalls(agentMetadata);
  const bannedSkills = [
    "azure-deploy", "azure-validate", "azure-prepare", "azure-cost",
    "azure-diagnostics", "azure-kubernetes", "azure-resource-lookup",
    "azure-compute", "azure-compliance", "azure-cloud-migrate",
  ];
  const violations: string[] = [];

  for (const tc of toolCalls) {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "skill" && toolName !== "invoke_skill") continue;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    for (const banned of bannedSkills) {
      if (args.includes(banned)) {
        violations.push(`${tc.data.toolName}: ${args.substring(0, 120)}`);
      }
    }
  }

  if (violations.length > 0) {
    agentMetadata.testComments.push(
      `❌ EXTERNAL SKILL BAN: Agent called external skills (violates pipeline-rules.md): ${violations.join("; ")}`,
    );
    if (hard) {
      expect(violations).toHaveLength(0);
    }
  }
}

/**
 * Assert the agent did NOT run destructive commands during deploy healing.
 * error-classification.md: "NEVER run az group delete, az postgres flexible-server delete,
 * az redis delete, az webapp delete."
 *
 * Non-fatal by default (logs warning). Set `hard = true` to fail the test.
 */
export function assertNoDestructiveHealingCommands(agentMetadata: AgentMetadata, hard = false): void {
  const toolCalls = getToolCalls(agentMetadata);
  const violations: string[] = [];

  for (const tc of toolCalls) {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "powershell" && toolName !== "bash" && toolName !== "run_command" && toolName !== "run_in_terminal") continue;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    if (/az\s+group\s+delete/i.test(cmd) ||
        /az\s+postgres\s+flexible-server\s+delete/i.test(cmd) ||
        /az\s+redis\s+delete/i.test(cmd) ||
        /az\s+webapp\s+delete/i.test(cmd) ||
        /az\s+functionapp\s+delete/i.test(cmd) ||
        /az\s+containerapp\s+delete/i.test(cmd)) {
      violations.push(`${tc.data.toolName}: ${cmd.substring(0, 120)}`);
    }
  }

  if (violations.length > 0) {
    agentMetadata.testComments.push(
      `❌ DESTRUCTIVE HEALING: Agent ran destructive commands during healing (violates error-classification.md): ${violations.join("; ")}`,
    );
    if (hard) {
      expect(violations).toHaveLength(0);
    }
  }
}

/**
 * Assert the agent did NOT ask the user for passwords or secrets during deploy.
 * deploy/SKILL.md Step 6: "NEVER ask_user for passwords — auto-generate into Key Vault."
 *
 * Non-fatal by default (logs warning). Set `hard = true` to fail the test.
 */
export function assertNoPasswordPrompts(agentMetadata: AgentMetadata, hard = false): void {
  const toolCalls = getToolCalls(agentMetadata);
  const violations: string[] = [];

  for (const tc of toolCalls) {
    if (tc.data.toolName !== "ask_user") continue;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    if (/password|secret|credential|passphrase|api.?key/i.test(args)) {
      violations.push(`ask_user: ${args.substring(0, 150)}`);
    }
  }

  if (violations.length > 0) {
    agentMetadata.testComments.push(
      `❌ PASSWORD PROMPT: Agent asked user for passwords/secrets (violates deploy/SKILL.md Step 6): ${violations.join("; ")}`,
    );
    if (hard) {
      expect(violations).toHaveLength(0);
    }
  }
}
