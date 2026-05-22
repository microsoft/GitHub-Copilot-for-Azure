/**
 * Shared test helpers for azure-app-onboard-prereq integration tests.
 *
 * Extracted to enable parallel test execution across Jest workers.
 * Each test file imports these helpers independently — no shared state.
 */

import {
  isSkillInvoked,
  softCheckSkill,
  shouldEarlyTerminateForSkillInvocation,
  getAllAssistantMessages,
  getAllToolText,
  getToolCalls,
  withTestResult,
  doesAssistantOrToolsIncludeKeyword,
} from "../utils/evaluate";
import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../utils/agent-runner";
import type { AgentMetadata } from "../utils/agent-runner";
import {
  assertDoesNotScaffoldOrDeploy,
  assertBlockingIssuesFlagged,
  assertSessionFileCreated,
  assertReEvaluationAfterFix,
  shouldEarlyTerminateOnPrereqComplete,
  shouldEarlyTerminateAfterRemediation,
  assertAgentScannedWorkspace,
  assertDoesNotBlindlyApprove,
  shouldEarlyTerminateOnScaffoldOrDeploy,
} from "../azure-app-onboard/app-onboard-test-helpers";
import { cloneRepo } from "../utils/git-clone";
import * as fs from "fs";
import * as path from "path";

// Re-export for convenience — test files only need one import
export {
  isSkillInvoked,
  softCheckSkill,
  shouldEarlyTerminateForSkillInvocation,
  getAllAssistantMessages,
  getAllToolText,
  getToolCalls,
  withTestResult,
  doesAssistantOrToolsIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
  assertDoesNotScaffoldOrDeploy,
  assertBlockingIssuesFlagged,
  assertSessionFileCreated,
  assertReEvaluationAfterFix,
  assertAgentScannedWorkspace,
  assertDoesNotBlindlyApprove,
  shouldEarlyTerminateOnScaffoldOrDeploy,
  cloneRepo,
};
export type { AgentMetadata };

export const SKILL_NAME = "azure-app-onboard-prereq";
export const functionalTestTimeoutMs = 900_000; // 15 minutes
export const negativeTestTimeoutMs = 600_000; // 10 minutes

/** Forbidden commands per SKILL.md absolute prohibition — no package-manager install/build/test. */
export const FORBIDDEN_COMMANDS = [
  "npm install", "npm test", "npx jest", "npm run test",
  "pip install", "pytest",
  "dotnet restore", "dotnet test", "dotnet build",
  "cargo build", "go mod download",
];

/**
 * Assert the agent did NOT run any forbidden commands (npm install, npm test, etc.).
 * This is the skill's #1 absolute prohibition — prereq is read-only evaluation.
 *
 * When `allowPostRemediationBuild` is true, npm install/test commands are allowed
 * IF the agent asked for permission first (build-validation gate: agent must ask before running install/build).
 * Hard-fails if the agent ran commands without asking.
 */
export function assertNoForbiddenCommands(agentMetadata: AgentMetadata, allowPostRemediationBuild = false): void {
  const toolCalls = getToolCalls(agentMetadata);
  const violations: string[] = [];

  for (const tc of toolCalls) {
    if (tc.data.toolName !== "powershell" && tc.data.toolName !== "bash" && tc.data.toolName !== "run_command" && tc.data.toolName !== "shell" && tc.data.toolName !== "terminal") continue;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    // Strip file content (here-strings, quoted strings) so forbidden commands
    // mentioned in written text (e.g. "run npm install to generate lockfile")
    // don't false-positive — only match actual shell command invocations
    const cmdExec = cmd
      .replace(/@"[\s\S]*?"@/g, "")
      .replace(/@'[\s\S]*?'@/g, "")
      .replace(/"(?:[^"\\]|\\.)*"/g, "")
      .replace(/'[^']*'/g, "");
    for (const forbidden of FORBIDDEN_COMMANDS) {
      if (cmdExec.includes(forbidden)) {
        violations.push(`${tc.data.toolName}: ${forbidden}`);
      }
    }
  }

  if (violations.length > 0) {
    if (allowPostRemediationBuild) {
      const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
      const permissionPatterns = [
        /want me to.{0,30}(install|build|run tests|fix|create)/i,
        /shall i.{0,30}(install|build|run tests|fix|create)/i,
        /would you like.{0,40}(install|build|run tests|fix|create)/i,
        /yes\s*\/\s*skip/i,
        /approve.{0,20}fix/i,
        /fix.{0,30}\?\s*$/im,
      ];
      const askedPermission = permissionPatterns.some(p => p.test(messages));
      if (askedPermission) {
        agentMetadata.testComments.push(`✅ BUILD-VALIDATION GATE: Agent asked permission before running: ${violations.join(", ")}`);
      } else {
        agentMetadata.testComments.push(`❌ PROHIBITION VIOLATION: Agent ran commands without asking permission: ${violations.join(", ")}`);
        expect(violations).toHaveLength(0);
      }
    } else {
      agentMetadata.testComments.push(`❌ PROHIBITION VIOLATION: Agent ran forbidden commands: ${violations.join(", ")}`);
      expect(violations).toHaveLength(0);
    }
  }
}

/** Valid values for overallHealth in prereq-output.json. */
const VALID_HEALTH_VALUES = ["ready", "readywithcaveats", "blocked"];

/** Valid verdict values per axis. */
const VALID_VERDICTS = ["PASS", "WARN", "FAIL", "SKIPPED"];

/**
 * Expected prereq verdicts from repo-catalog.json ground truth.
 */
export interface ExpectedVerdicts {
  build: string;
  completeness: string;
  deployability: string;
}

/**
 * Assert prereq-output.json was written to the workspace session directory
 * and contains required fields with correct schema depth.
 *
 * Hardened version — validates:
 * - components[] array with per-component schema (name, path, stack, verdicts)
 * - overallHealth is one of "ready" | "readyWithCaveats" | "blocked"
 * - warnings[] array with per-warning schema (id, fix, fixPhase)
 * - Verdict propagation invariant: FAIL finding → FAIL axis verdict
 * - Optional ground-truth verdict comparison against repo-catalog.json
 *
 * Returns the parsed artifact or null if not found.
 */
export function assertPrereqArtifactWritten(
  agentMetadata: AgentMetadata,
  workspacePath: string,
  expectedHealth?: "blocked" | "ready" | "warnings",
  expectedVerdicts?: ExpectedVerdicts,
): Record<string, unknown> | null {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("⚠️ ARTIFACT NOT FOUND: .copilot-azure/sessions/ does not exist — prereq-output.json not written");
    return null;
  }

  const sessionFolders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());

  let prereqOutput: Record<string, unknown> | null = null;
  for (const folder of sessionFolders) {
    const prereqPath = path.join(sessionDir, folder, "prereq-output.json");
    if (fs.existsSync(prereqPath)) {
      try {
        prereqOutput = JSON.parse(fs.readFileSync(prereqPath, "utf-8")) as Record<string, unknown>;
      } catch {
        agentMetadata.testComments.push("⚠️ ARTIFACT MALFORMED: prereq-output.json exists but is not valid JSON");
      }
      break;
    }
  }

  if (!prereqOutput) {
    // Check if agent wrote it via tool calls but to a different location
    const toolCalls = getToolCalls(agentMetadata);
    const wrotePrereq = toolCalls.some(tc =>
      (tc.data.toolName === "create_file" || tc.data.toolName === "create" || tc.data.toolName === "write_file") &&
      JSON.stringify(tc.data.arguments ?? {}).includes("prereq-output"));
    if (wrotePrereq) {
      agentMetadata.testComments.push("⚠️ ARTIFACT LOCATION: Agent wrote prereq-output.json via tool call but file not found at expected session path");
    } else {
      agentMetadata.testComments.push("⚠️ ARTIFACT MISSING: prereq-output.json was never written");
    }
    return null;
  }

  // --- Hard schema validation ---

  // 1. components[] must be a non-empty array
  expect(Array.isArray(prereqOutput.components)).toBe(true);
  const components = prereqOutput.components as Record<string, unknown>[];
  if (components.length === 0) {
    agentMetadata.testComments.push("⚠️ ARTIFACT SCHEMA: prereq-output.json has empty components[] array");
  }

  // 2. Each component must have name, path, stack (with language + framework), verdicts
  for (const comp of components) {
    if (!comp.name) {
      agentMetadata.testComments.push(`⚠️ COMPONENT SCHEMA: component missing 'name' field`);
    }
    if (!comp.path && comp.path !== ".") {
      agentMetadata.testComments.push(`⚠️ COMPONENT SCHEMA: component "${comp.name}" missing 'path' field`);
    }
    const stack = comp.stack as Record<string, unknown> | undefined;
    if (!stack || !stack.language) {
      agentMetadata.testComments.push(`⚠️ COMPONENT SCHEMA: component "${comp.name}" missing stack.language`);
    }
    const verdicts = comp.verdicts as Record<string, unknown> | undefined;
    if (verdicts) {
      // Validate verdict values are in allowed set
      for (const axis of ["build", "completeness", "deployability"]) {
        const v = verdicts[axis] as string | undefined;
        if (v && !VALID_VERDICTS.includes(v)) {
          agentMetadata.testComments.push(`❌ VERDICT VALUE: component "${comp.name}" axis "${axis}" has invalid verdict "${v}"`);
        }
      }

      // --- Verdict propagation invariant ---
      // If any finding has verdict "FAIL", the corresponding axis verdict MUST be "FAIL"
      const findings = comp.findings as Array<Record<string, unknown>> | undefined;
      if (findings && Array.isArray(findings)) {
        for (const axis of ["build", "completeness", "deployability"]) {
          const axisFindings = findings.filter(f => f.category === axis);
          const hasFailFinding = axisFindings.some(f => f.verdict === "FAIL");
          const axisVerdict = verdicts[axis] as string | undefined;
          if (hasFailFinding && axisVerdict && axisVerdict !== "FAIL") {
            agentMetadata.testComments.push(
              `❌ VERDICT INVARIANT VIOLATED: component "${comp.name}" axis "${axis}" has FAIL finding but axis verdict is "${axisVerdict}" (must be FAIL)`
            );
            expect(axisVerdict).toBe("FAIL");
          }
        }
      }
    }
  }

  // 3. overallHealth must be one of the valid values
  expect(prereqOutput.overallHealth).toBeTruthy();
  const healthStr = String(prereqOutput.overallHealth).toLowerCase().replace(/\s+/g, "");
  if (!VALID_HEALTH_VALUES.includes(healthStr)) {
    agentMetadata.testComments.push(
      `⚠️ HEALTH VALUE: overallHealth="${prereqOutput.overallHealth}" is not one of ready/readyWithCaveats/blocked`
    );
  }

  // 4. warnings[] array validation (if present)
  if (prereqOutput.warnings && Array.isArray(prereqOutput.warnings)) {
    for (const w of prereqOutput.warnings as Record<string, unknown>[]) {
      if (!w.id) {
        agentMetadata.testComments.push(`⚠️ WARNING SCHEMA: warning missing 'id' field`);
      }
      if (!w.fix) {
        agentMetadata.testComments.push(`⚠️ WARNING SCHEMA: warning "${w.id}" missing 'fix' field (required per prereq-schemas.ts)`);
      }
      if (!w.fixPhase) {
        agentMetadata.testComments.push(`⚠️ WARNING SCHEMA: warning "${w.id}" missing 'fixPhase' field (required per prereq-schemas.ts)`);
      }
    }
  }

  // 5. Validate expected health status if specified
  if (expectedHealth && prereqOutput.overallHealth) {
    const health = String(prereqOutput.overallHealth).toLowerCase();
    if (!health.includes(expectedHealth)) {
      agentMetadata.testComments.push(
        `⚠️ HEALTH MISMATCH: expected overallHealth to include "${expectedHealth}", got "${prereqOutput.overallHealth}"`
      );
    }
  }

  // 6. Catalog-driven verdict comparison
  if (expectedVerdicts && components.length > 0) {
    // Use first component's verdicts for comparison (single-component repos)
    // For monorepos, check if ANY component matches expected verdicts
    const matchesExpected = components.some(comp => {
      const verdicts = comp.verdicts as Record<string, unknown> | undefined;
      if (!verdicts) return false;
      return (
        verdicts.build === expectedVerdicts.build &&
        verdicts.completeness === expectedVerdicts.completeness &&
        verdicts.deployability === expectedVerdicts.deployability
      );
    });

    if (!matchesExpected) {
      // Log actual verdicts for diagnosis
      const actualVerdicts = components.map(c => {
        const v = c.verdicts as Record<string, unknown> | undefined;
        return `${c.name}: build=${v?.build}, completeness=${v?.completeness}, deployability=${v?.deployability}`;
      }).join("; ");
      agentMetadata.testComments.push(
        `⚠️ VERDICT MISMATCH vs catalog: expected build=${expectedVerdicts.build}, completeness=${expectedVerdicts.completeness}, deployability=${expectedVerdicts.deployability}. ` +
        `Actual: ${actualVerdicts}`
      );
    }
  }

  agentMetadata.testComments.push(
    `✅ prereq-output.json validated: overallHealth=${prereqOutput.overallHealth}, ` +
    `components=${components.length}, isMonorepo=${prereqOutput.isMonorepo ?? "unset"}`
  );
  return prereqOutput;
}

/**
 * Assert session artifacts are fully created and valid on disk.
 * Hard assertions on file existence and basic parsability.
 */
export function assertSessionArtifactsComplete(
  agentMetadata: AgentMetadata,
  workspacePath: string,
): { sessionId: string; contextJson: Record<string, unknown> } | null {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("❌ SESSION: .copilot-azure/sessions/ does not exist");
    expect(fs.existsSync(sessionDir)).toBe(true);
    return null;
  }

  // active-session.json must exist
  const activeSessionPath = path.join(sessionDir, "active-session.json");
  if (!fs.existsSync(activeSessionPath)) {
    agentMetadata.testComments.push("⚠️ SESSION: active-session.json not found — session pointer missing");
  }

  // Find session folder (UUID format)
  const sessionFolders = fs.readdirSync(sessionDir).filter(f => {
    const fullPath = path.join(sessionDir, f);
    return fs.statSync(fullPath).isDirectory() && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f);
  });

  if (sessionFolders.length === 0) {
    agentMetadata.testComments.push("❌ SESSION: No UUID-formatted session folder found");
    // Non-UUID folders may exist — allow test to continue with a soft warning
    const allFolders = fs.readdirSync(sessionDir).filter(f =>
      fs.statSync(path.join(sessionDir, f)).isDirectory());
    if (allFolders.length > 0) {
      agentMetadata.testComments.push(`⚠️ SESSION: Found folders but none match UUID format: ${allFolders.join(", ")}`);
    }
  }

  const sessionFolder = sessionFolders[0] ?? fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory())[0];
  if (!sessionFolder) return null;

  const sessionId = sessionFolder;
  const sessionPath = path.join(sessionDir, sessionFolder);

  // context.json — parse and validate
  const ctxPath = path.join(sessionPath, "context.json");
  if (!fs.existsSync(ctxPath)) {
    agentMetadata.testComments.push("❌ SESSION: context.json not found in session folder");
    return null;
  }

  let contextJson: Record<string, unknown>;
  try {
    contextJson = JSON.parse(fs.readFileSync(ctxPath, "utf-8")) as Record<string, unknown>;
  } catch {
    agentMetadata.testComments.push("❌ SESSION: context.json exists but is not valid JSON");
    return null;
  }

  // Validate context.json fields
  if (contextJson.sessionId) {
    agentMetadata.testComments.push(`✅ SESSION: sessionId=${contextJson.sessionId}`);
  }

  const completedPhases = contextJson.completedPhases as string[] | undefined;
  if (completedPhases && Array.isArray(completedPhases) && completedPhases.includes("prereq")) {
    agentMetadata.testComments.push("✅ SESSION: completedPhases includes 'prereq'");
  } else {
    agentMetadata.testComments.push(
      `⚠️ SESSION: completedPhases does not include 'prereq' (value: ${JSON.stringify(completedPhases)})`
    );
  }

  if (contextJson.currentPhase === null || contextJson.currentPhase === undefined) {
    agentMetadata.testComments.push("✅ SESSION: currentPhase is null (phase complete)");
  } else {
    agentMetadata.testComments.push(`⚠️ SESSION: currentPhase is "${contextJson.currentPhase}" (expected null after prereq completion)`);
  }

  // repo.lastScanCommit should be 40-char hex
  const repo = contextJson.repo as Record<string, unknown> | undefined;
  if (repo?.lastScanCommit) {
    const commit = String(repo.lastScanCommit);
    if (/^[0-9a-f]{40}$/i.test(commit)) {
      agentMetadata.testComments.push(`✅ SESSION: repo.lastScanCommit is valid SHA: ${commit.substring(0, 8)}…`);
    } else {
      agentMetadata.testComments.push(`⚠️ SESSION: repo.lastScanCommit is not a 40-char hex: "${commit}"`);
    }
  }

  // prereq-output.json
  const prereqPath = path.join(sessionPath, "prereq-output.json");
  if (fs.existsSync(prereqPath)) {
    agentMetadata.testComments.push("✅ SESSION: prereq-output.json present");
  } else {
    agentMetadata.testComments.push("⚠️ SESSION: prereq-output.json not found in session folder");
  }

  // readiness-report.md — validate existence, length, structure, and content
  const reportPath = path.join(sessionPath, "readiness-report.md");
  if (fs.existsSync(reportPath)) {
    const reportContent = fs.readFileSync(reportPath, "utf-8");
    if (reportContent.length > 50) {
      agentMetadata.testComments.push(`✅ SESSION: readiness-report.md present (${reportContent.length} chars)`);
    } else {
      agentMetadata.testComments.push(`⚠️ SESSION: readiness-report.md is very short (${reportContent.length} chars)`);
    }

    // Check for heading structure (at least 1 ## heading)
    if (/^#{1,3}\s+/m.test(reportContent)) {
      agentMetadata.testComments.push("✅ SESSION: readiness-report.md has heading structure");
    } else {
      agentMetadata.testComments.push("⚠️ SESSION: readiness-report.md lacks heading structure");
    }

    // Check for verdict mentions (PASS/WARN/FAIL)
    if (/pass|warn|fail/i.test(reportContent)) {
      agentMetadata.testComments.push("✅ SESSION: readiness-report.md mentions verdicts");
    } else {
      agentMetadata.testComments.push("⚠️ SESSION: readiness-report.md lacks verdict mentions");
    }
  } else {
    agentMetadata.testComments.push("⚠️ SESSION: readiness-report.md not found in session folder");
  }

  return { sessionId, contextJson };
}

/** Early terminate once prereq-output.json is written — prereq phase is done. */
export function earlyTerminateOnPrereqComplete(agentMetadata: AgentMetadata): boolean {
  return shouldEarlyTerminateOnPrereqComplete(agentMetadata, SKILL_NAME);
}

/** Early terminate after 2nd prereq-output.json write — allows remediation cycle. */
export function earlyTerminateAfterRemediation(agentMetadata: AgentMetadata): boolean {
  return shouldEarlyTerminateAfterRemediation(agentMetadata, SKILL_NAME);
}

/**
 * Assert routing fields were written to context.json (Step 7–8 validation).
 *
 * Checks:
 * - completedPhases includes "prereq"
 * - currentPhase is null
 * - routeToSkill / routeReason (if expectedRouteToSkill provided, asserts match)
 */
export function assertRoutingFieldsWritten(
  agentMetadata: AgentMetadata,
  workspacePath: string,
  expectedRouteToSkill?: string,
): void {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("⚠️ ROUTING: .copilot-azure/sessions/ does not exist — cannot check routing fields");
    return;
  }

  const sessionFolders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());

  for (const folder of sessionFolders) {
    const ctxPath = path.join(sessionDir, folder, "context.json");
    if (!fs.existsSync(ctxPath)) continue;

    let contextJson: Record<string, unknown>;
    try {
      contextJson = JSON.parse(fs.readFileSync(ctxPath, "utf-8")) as Record<string, unknown>;
    } catch {
      agentMetadata.testComments.push("⚠️ ROUTING: context.json exists but is not valid JSON");
      return;
    }

    // Step 7: completedPhases must include "prereq"
    const completedPhases = contextJson.completedPhases as string[] | undefined;
    if (completedPhases && Array.isArray(completedPhases) && completedPhases.includes("prereq")) {
      agentMetadata.testComments.push("✅ ROUTING: completedPhases includes 'prereq'");
    } else {
      agentMetadata.testComments.push(
        `⚠️ ROUTING: completedPhases does not include 'prereq' (value: ${JSON.stringify(completedPhases)})`
      );
    }

    // Step 7: currentPhase must be null
    if (contextJson.currentPhase === null || contextJson.currentPhase === undefined) {
      agentMetadata.testComments.push("✅ ROUTING: currentPhase is null");
    } else {
      agentMetadata.testComments.push(`⚠️ ROUTING: currentPhase is "${contextJson.currentPhase}" (expected null)`);
    }

    // Step 8: routeToSkill
    if (expectedRouteToSkill) {
      const routeToSkill = contextJson.routeToSkill as string | undefined;
      if (routeToSkill) {
        agentMetadata.testComments.push(`✅ ROUTING: routeToSkill="${routeToSkill}"`);
        expect(routeToSkill).toBe(expectedRouteToSkill);
      } else {
        agentMetadata.testComments.push(
          `⚠️ ROUTING: routeToSkill not set (expected "${expectedRouteToSkill}")`
        );
      }
    }

    // routeReason (informational)
    const routeReason = contextJson.routeReason as string | undefined;
    if (routeReason) {
      agentMetadata.testComments.push(`✅ ROUTING: routeReason="${routeReason}"`);
    }

    return; // Only check the first session folder
  }
}

/**
 * Assert the agent detected existing Azure infrastructure (azure.yaml, Bicep, Terraform).
 *
 * Checks:
 * - Agent mentioned expected infra files in messages or tool calls
 * - prereq-output.json or context.json has existingAzdProject or detectedInfra populated
 */
export function assertExistingInfraDetected(
  agentMetadata: AgentMetadata,
  expectedFiles: readonly string[],
): void {
  const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();

  // Check agent mentioned at least one expected infra file
  const mentionedFiles = expectedFiles.filter(f => messages.includes(f.toLowerCase()));
  if (mentionedFiles.length > 0) {
    agentMetadata.testComments.push(`✅ INFRA DETECTED: Agent mentioned ${mentionedFiles.join(", ")}`);
  } else {
    agentMetadata.testComments.push(
      `⚠️ INFRA NOT DETECTED: Agent did not mention any of [${expectedFiles.join(", ")}]`
    );
  }
  expect(mentionedFiles.length).toBeGreaterThan(0);

  // Check tool calls for reading infra files
  const toolCalls = getToolCalls(agentMetadata);
  const readInfraFile = toolCalls.some(tc => {
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return expectedFiles.some(f => args.includes(f.toLowerCase()));
  });
  if (readInfraFile) {
    agentMetadata.testComments.push("✅ INFRA DETECTED: Agent read infra file via tool call");
  }

  // Check for existingAzdProject or detectedInfra in messages/tool output
  const detectsExistingProject =
    messages.includes("existing") && (messages.includes("azure.yaml") || messages.includes("bicep") || messages.includes("terraform")) ||
    messages.includes("existingazdproject") ||
    messages.includes("detectedinfra");
  if (detectsExistingProject) {
    agentMetadata.testComments.push("✅ INFRA DETECTED: Agent recognized existing Azure project");
  }
}

/**
 * Assert the agent presented findings grouped by severity (Step 5 validation).
 *
 * Checks:
 * - Assistant messages contain severity indicators (verdict icons or keywords)
 * - Agent referenced readiness-report.md
 * - readiness-report.md exists with heading structure if workspace path provided
 */
export function assertFindingsPresentedBySeverity(
  agentMetadata: AgentMetadata,
  workspacePath?: string,
): void {
  const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();

  // Check for severity-grouped output — verdict icons or severity keywords
  const severityIndicators = [
    "✅", "⚠️", "❌", "🔧",
    "pass", "warn", "fail",
    "critical", "blocking", "warning",
    "readiness", "ready",
  ];
  const foundIndicators = severityIndicators.filter(s => messages.includes(s.toLowerCase()));
  if (foundIndicators.length >= 2) {
    agentMetadata.testComments.push(`✅ FINDINGS: Severity indicators found: ${foundIndicators.join(", ")}`);
  } else {
    agentMetadata.testComments.push("⚠️ FINDINGS: Fewer than 2 severity indicators in agent output");
  }
  expect(foundIndicators.length).toBeGreaterThanOrEqual(2);

  // Check agent referenced readiness-report.md
  const mentionsReport = messages.includes("readiness-report") || messages.includes("readiness report");
  if (mentionsReport) {
    agentMetadata.testComments.push("✅ FINDINGS: Agent referenced readiness-report.md");
  } else {
    agentMetadata.testComments.push("⚠️ FINDINGS: Agent did not reference readiness-report.md");
  }

  // If workspace provided, validate readiness-report.md content
  if (workspacePath) {
    const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
    if (fs.existsSync(sessionDir)) {
      const sessionFolders = fs.readdirSync(sessionDir).filter(f =>
        fs.statSync(path.join(sessionDir, f)).isDirectory());
      for (const folder of sessionFolders) {
        const reportPath = path.join(sessionDir, folder, "readiness-report.md");
        if (fs.existsSync(reportPath)) {
          const content = fs.readFileSync(reportPath, "utf-8");
          if (content.length > 200) {
            agentMetadata.testComments.push(`✅ FINDINGS: readiness-report.md has ${content.length} chars`);
          } else {
            agentMetadata.testComments.push(`⚠️ FINDINGS: readiness-report.md is short (${content.length} chars)`);
          }

          // Check for heading structure
          const hasHeadings = /^#{1,3}\s+/m.test(content);
          if (hasHeadings) {
            agentMetadata.testComments.push("✅ FINDINGS: readiness-report.md has heading structure");
          } else {
            agentMetadata.testComments.push("⚠️ FINDINGS: readiness-report.md lacks heading structure");
          }

          // Check for verdict mentions
          const hasVerdicts = /pass|warn|fail/i.test(content);
          if (hasVerdicts) {
            agentMetadata.testComments.push("✅ FINDINGS: readiness-report.md mentions verdicts");
          } else {
            agentMetadata.testComments.push("⚠️ FINDINGS: readiness-report.md lacks verdict mentions");
          }
          break;
        }
      }
    }
  }
}

/**
 * Create the integration test describe block with standard skip logic.
 * Returns { describeIntegration, agent } for use in test files.
 */
export function setupIntegrationSuite(): {
  skipTests: boolean;
  describeIntegration: typeof describe | typeof describe.skip;
} {
  const skipTests = shouldSkipIntegrationTests();
  const skipReason = getIntegrationSkipReason();

  if (skipTests && skipReason) {
    console.log(`⏭️  Skipping integration tests: ${skipReason}`);
  }

  return {
    skipTests,
    describeIntegration: skipTests ? describe.skip : describe,
  };
}
