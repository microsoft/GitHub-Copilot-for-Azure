/**
 * Context + shared TypeScript interfaces for AppOnboard session artifacts:
 * context.json, active-session.json, and shared types used across all phases.
 *
 * Per-phase schemas (each sub-skill has its own in its references/ folder):
 * - azure-app-onboard-prereq/references/prereq-schemas.ts — prereq-output.json
 * - prepare/references/prepare-schemas.ts — prepare-plan.json
 * - scaffold/references/scaffold-schemas.ts — scaffold-manifest.json
 * - deploy/references/deploy-schemas.ts — deploy-result.json
 *
 * Source of truth for JSON artifacts in `.copilot-azure/sessions/{session-id}/`.
 */

// ─── shared types (used across all phases) ───────────────────────────────────

export interface AppOnboardComponentStack {
  language: string;
  framework: string;
  version: string;
}

export type ReadinessStatus = "ready" | "fixesApplied" | "needsFixes" | "unknown";

export interface AppOnboardComponentReadiness {
  status: ReadinessStatus;
  fixes: string[];
}

export type VerdictLevel = "PASS" | "WARN" | "FAIL" | "SKIPPED";

export interface AppOnboardComponentVerdicts {
  build: VerdictLevel;
  completeness: Exclude<VerdictLevel, "SKIPPED">;
  deployability: Exclude<VerdictLevel, "SKIPPED">;
}

export interface AppOnboardComponentFinding {
  category: "build" | "completeness" | "deployability";
  verdict: VerdictLevel;
  summary: string;
  fix: string | null;
}

export interface AppOnboardComponent {
  name: string;
  path: string;
  stack: AppOnboardComponentStack;
  readiness: AppOnboardComponentReadiness;
  /** REQUIRED — every component MUST carry per-axis verdicts (build/completeness/deployability); the prepare phase reads these for readiness scoring. Never omit, even for multi-component repos. */
  verdicts: AppOnboardComponentVerdicts;
  /** Per-axis problems + fixes. Omit or leave empty when all verdicts PASS. ⛔ REQUIRED when any verdict is WARN or FAIL: every non-PASS axis MUST have a matching entry (same `category`) explaining the issue and its fix. */
  findings?: readonly AppOnboardComponentFinding[];
}

export interface AppOnboardAzureTarget {
  subscriptionId: string;
  /** Display name of the subscription (from `az account show --query name`).
   *  Shown at both approval gates so the user can verify the target. */
  subscriptionName: string;
  resourceGroup: string;
  region: string;
  /** Entra tenant ID from `az account show --query tenantId`. */
  tenantId: string;
  /** Signed-in user's display name (`az ad signed-in-user show --query displayName`) — used for the `deployed-by` tag and handoff identity. */
  userDisplayName?: string;
}

export interface AppOnboardRepoInfo {
  remote: string | null;
  /** Full 40-char HEAD SHA at last prereq scan (`git rev-parse HEAD`). Prereq resume compares to HEAD to detect repo changes (staleness guard). */
  lastScanCommit?: string;
}

export interface AppOnboardOverride {
  key: string;
  value: string;
  reason: string;
}

export interface AppOnboardAppInfo {
  name: string;
}

export interface PostDeployRecommendation {
  title: string;
  reason: string;
  effort: "low" | "medium" | "high";
  services?: string[];
}

export interface DetectedService {
  type: string;
  version?: string;
  source: "compose" | "config" | "code";
}

// ─── context.json ─────────────────────────────────────────────────────────────

export interface AppOnboardIntent {
  userPrompt: string;
  description: string;
  users?: string;
  auth?: string;
  scale?: string;
  budget?: string;
  /** Set to true after prereq scan refines intent */
  refinedFromScan?: boolean;
  /** Facts discovered by the prereq scan */
  scanDiscoveredFacts?: string[];
}

export type AppOnboardPhase = "info" | "prereq" | "prepare" | "scaffold" | "deploy";

export interface AppOnboardContext {
  sessionId: string;
  createdUtc: string;
  lastModifiedUtc: string;
  currentPhase: AppOnboardPhase | null;
  completedPhases: readonly AppOnboardPhase[];
  /** Human-readable 1-line summary of where the session stands, updated at each phase exit.
   *  Displayed in the session picker when the user resumes or switches sessions. */
  statusSummary?: string;
  intent: AppOnboardIntent;
  components: AppOnboardComponent[];
  azure: AppOnboardAzureTarget;
  repo: AppOnboardRepoInfo;
  app?: AppOnboardAppInfo;
  /** Infrastructure file types detected in repo: dockerfile, terraform, bicep, azure-yaml, github-actions */
  detectedInfra: readonly string[];
  /** Cloud provider targeted by detected IaC. Only populated when `.tf` or `.bicep` files found.
   *  Used by scaffold to distinguish "existing Azure IaC" (halt) from "non-Azure IaC" (generate Azure TF alongside). */
  detectedInfraProvider?: {
    terraform?: "azure" | "gcp" | "aws" | "multi" | "unknown";
  };
  /** Service dependencies parsed from docker-compose, config files, or code imports */
  detectedServices: readonly DetectedService[];
  overrides: AppOnboardOverride[];
  /** The skill to invoke next. Set by the cloud-SDK gate, specialized-skill detection, or
   *  normal health+infra routing. Examples: "azure-cloud-migrate", "microsoft-foundry", "azure-prepare".
   *  Presence halts the greenfield pipeline; the resume path in session-protocol.md clears it and re-runs prereq. */
  routeToSkill?: string;
  /** Why this route was chosen. Examples: "cloud-sdk-migration", "existing-azd-template", "foundry-agents-detected", "ready-no-infra", "ready-existing-infra". */
  routeReason?: string;
}

// ─── active-session.json ─────────────────────────────────────────────────────

/** Pointer file at `.copilot-azure/sessions/active-session.json`.
 *  Avoids scanning all session folders on startup — read this one file
 *  to find the active session, then read that session's context.json. */
export interface ActiveSessionPointer {
  activeSessionId: string;
}

// PrereqOutput, BuildRequirements → see azure-app-onboard-prereq/references/prereq-schemas.ts