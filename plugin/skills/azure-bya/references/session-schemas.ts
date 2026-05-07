/**
 * Context + shared TypeScript interfaces for BYA session artifacts:
 * context.json, active-session.json, and shared types used across all phases.
 *
 * Per-phase schemas (load only when entering that phase):
 * - prereq-schemas.ts (in azure-bya-prereq) — prereq-output.json (PrereqOutput, BuildRequirements, CloudSdkSwap)
 * - session-schemas-prepare.ts — prepare-plan.json (PreparePlan, PlannedService, etc.)
 * - session-schemas-deploy.ts — scaffold-manifest.json, deploy-result.json
 *
 * Source of truth for JSON artifacts in `.copilot-azure/sessions/{session-id}/`.
 */

// ─── shared types (used across all phases) ───────────────────────────────────

export interface BYAComponentStack {
  language: string;
  framework: string;
  version: string;
}

export type ReadinessStatus = "ready" | "fixesApplied" | "needsFixes" | "unknown";

export interface BYAComponentReadiness {
  status: ReadinessStatus;
  fixes: string[];
}

export type VerdictLevel = "PASS" | "WARN" | "FAIL" | "SKIPPED";

export interface BYAComponentVerdicts {
  build: VerdictLevel;
  completeness: Exclude<VerdictLevel, "SKIPPED">;
  deployability: Exclude<VerdictLevel, "SKIPPED">;
}

export interface BYAComponentFinding {
  category: "build" | "completeness" | "deployability";
  verdict: VerdictLevel;
  summary: string;
  fix: string | null;
}

export interface BYAComponent {
  name: string;
  path: string;
  stack: BYAComponentStack;
  readiness: BYAComponentReadiness;
  verdicts?: BYAComponentVerdicts;
  findings?: readonly BYAComponentFinding[];
}

export interface BYAAzureTarget {
  subscriptionId: string;
  /** Display name of the subscription (from `az account show --query name`).
   *  Shown at both approval gates so the user can verify the target. */
  subscriptionName: string;
  resourceGroup: string;
  region: string;
}

export interface BYARepoInfo {
  remote: string | null;
  defaultBranch: string;
  currentBranch: string;
}

export interface BYAOverride {
  key: string;
  value: string;
  reason: string;
}

export interface BYAAppInfo {
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

// ─── quick-probe (Pass 1 of two-pass intent) ─────────────────────────────────

export interface QuickProbeFile {
  path: string;
  /** What was extracted: "dependencies", "scripts", "name", "compose services", etc. */
  extracted: string;
}

export interface QuickProbeResult {
  /** Total files in workspace */
  totalFileCount: number;
  /** Files actually read during probe */
  filesRead: QuickProbeFile[];
  /** Top-level project manifests found (package.json, requirements.txt, etc.) */
  manifestsFound: string[];
  /** Preliminary stack detection from manifests (e.g., "Node.js/Express", "Python/Django") */
  detectedStack: string | null;
  /** Preliminary Azure service suggestions based on probe alone */
  preliminaryServices: string[];
  /** Open questions the probe could NOT answer — forwarded to user */
  unansweredQuestions: string[];
}

// ─── context.json ─────────────────────────────────────────────────────────────

export interface BYAIntent {
  userPrompt: string;
  description: string;
  users?: string;
  auth?: string;
  dataModel?: string;
  scale?: string;
  budget?: string;
  /** Set to true by Step 4 (Pass 2) after prereq scan refines intent */
  refinedFromScan?: boolean;
  /** Facts discovered by the prereq scan that the quick probe missed */
  scanDiscoveredFacts?: string[];
}

export type BYAPhase = "info" | "prereq" | "prepare" | "scaffold" | "deploy" | "cicd" | "observe";

export interface BYAContext {
  sessionId: string;
  createdUtc: string;
  lastModifiedUtc: string;
  currentPhase: BYAPhase | null;
  completedPhases: readonly BYAPhase[];
  /** Human-readable 1-line summary of where the session stands, updated at each phase exit.
   *  Displayed in the session picker when the user resumes or switches sessions. */
  statusSummary?: string;
  intent: BYAIntent;
  /** Pass 1 quick probe results — consumed by prereq (Step 3) and refine intent (Step 4) */
  quickProbe?: QuickProbeResult;
  components: BYAComponent[];
  azure: BYAAzureTarget;
  repo: BYARepoInfo;
  app?: BYAAppInfo;
  /** Infrastructure file types detected in repo: dockerfile, terraform, bicep, azure-yaml, github-actions */
  detectedInfra: readonly string[];
  /** Cloud provider targeted by detected IaC. Only populated when `.tf` or `.bicep` files found.
   *  Used by scaffold to distinguish "existing Azure IaC" (halt) from "non-Azure IaC" (generate Azure TF alongside). */
  detectedInfraProvider?: {
    terraform?: "azure" | "gcp" | "aws" | "multi" | "unknown";
  };
  /** Service dependencies parsed from docker-compose, config files, or code imports */
  detectedServices: readonly DetectedService[];
  overrides: BYAOverride[];
}

// ─── active-session.json ─────────────────────────────────────────────────────

/** Pointer file at `.copilot-azure/sessions/active-session.json`.
 *  Avoids scanning all session folders on startup — read this one file
 *  to find the active session, then read that session's context.json. */
export interface ActiveSessionPointer {
  activeSessionId: string;
}

// PrereqOutput, BuildRequirements, CloudSdkSwap -> azure-bya-prereq/references/prereq-schemas.ts
// PrereqOutput, BuildRequirements, CloudSdkSwap → azure-bya-prereq/references/prereq-schemas