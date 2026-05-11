/**
 * Context + shared TypeScript interfaces for AppOnboard session artifacts:
 * context.json, active-session.json, and shared types used across all phases.
 *
 * Per-phase schemas (load only when entering that phase):
 * - prereq-schemas.ts (in azure-app-onboard-prereq) — prereq-output.json (PrereqOutput, BuildRequirements, CloudSdkSwap)
 * - session-schemas-prepare.ts — prepare-plan.json (PreparePlan, PlannedService, etc.)
 * - session-schemas-deploy.ts — scaffold-manifest.json, deploy-result.json
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
  verdicts?: AppOnboardComponentVerdicts;
  findings?: readonly AppOnboardComponentFinding[];
}

export interface AppOnboardAzureTarget {
  subscriptionId: string;
  /** Display name of the subscription (from `az account show --query name`).
   *  Shown at both approval gates so the user can verify the target. */
  subscriptionName: string;
  resourceGroup: string;
  region: string;
}

export interface AppOnboardRepoInfo {
  remote: string | null;
  defaultBranch: string;
  currentBranch: string;
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

// ─── quick-probe (Pass 1 of two-pass intent) ─────────────────────────────────

export interface QuickProbeFile {
  path: string;
  /** What was extracted: "dependencies", "scripts", "name", "compose services", etc. */
  extracted: string;
}

/** Per-manifest structured snapshot so prereq can skip re-reading manifests. */
export interface ManifestSnapshot {
  /** Relative path to the manifest (e.g., "package.json", "server/package.json") */
  path: string;
  /** Language/framework detected from this manifest */
  stack: string;
  /** Dependency names (keys only — no versions needed) */
  dependencies: string[];
  /** Dev dependency names (keys only) */
  devDependencies?: string[];
  /** Entry point declared in manifest (e.g., package.json "main" or "start" script target) */
  entryPoint?: string;
  /** Engine/runtime version constraints (e.g., { "node": ">=20" }) */
  engines?: Record<string, string>;
  /** Build script name if present (e.g., "build", "tsc") */
  buildScript?: string;
  /** Lock file detected alongside this manifest */
  lockFile?: string;
}

/** Dockerfile metadata extracted during probe. */
export interface DockerfileSnapshot {
  path: string;
  /** Base image(s) detected (e.g., ["node:20-alpine", "nginx:alpine"]) */
  baseImages: string[];
  /** EXPOSE port(s) */
  exposePorts: number[];
  /** true if multi-stage build detected */
  multiStage: boolean;
}

/** Compose service extracted during probe. */
export interface ComposeServiceSnapshot {
  name: string;
  image?: string;
  /** Ports mapped (host:container) */
  ports?: string[];
}

/** Import sample from a source file — used by prereq for cross-check without re-reading. */
export interface ImportSample {
  /** Source file path */
  file: string;
  /** Package/module names imported (external only, not relative) */
  packages: string[];
}

export interface QuickProbeResult {
  /** Total files in workspace */
  totalFileCount: number;
  /** Files actually read during probe */
  filesRead: QuickProbeFile[];
  /** Top-level project manifests found (package.json, requirements.txt, etc.) */
  manifestsFound: string[];
  /** Structured per-manifest snapshots — prereq reuses these instead of re-reading */
  manifests: ManifestSnapshot[];
  /** Dockerfile metadata if Dockerfile found */
  dockerfiles?: DockerfileSnapshot[];
  /** Compose services if docker-compose.yml found */
  composeServices?: ComposeServiceSnapshot[];
  /** Import samples from entry points + 2-3 source files per component */
  importSamples?: ImportSample[];
  /** Preliminary stack detection from manifests (e.g., "Node.js/Express", "Python/Django") */
  detectedStack: string | null;
  /** Preliminary Azure service suggestions based on probe alone */
  preliminaryServices: string[];
  /** Open questions the probe could NOT answer — forwarded to user */
  unansweredQuestions: string[];
  /** Early halt signal — set if probe detects obvious blockers (vulnerable app dirs, no code at all) */
  earlyHaltSignal?: string;
  /** Missing files referenced but not found on disk (e.g., entry point declared but file missing) */
  missingFiles?: string[];
  /** Health endpoint detected (e.g., "/health", "/healthz") */
  healthEndpoint?: string | null;
}

// ─── context.json ─────────────────────────────────────────────────────────────

export interface AppOnboardIntent {
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

export type AppOnboardPhase = "info" | "prereq" | "prepare" | "scaffold" | "deploy" | "cicd" | "observe";

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
  /** Pass 1 quick probe results — consumed by prereq (Step 3) and refine intent (Step 4) */
  quickProbe?: QuickProbeResult;
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
}

// ─── active-session.json ─────────────────────────────────────────────────────

/** Pointer file at `.copilot-azure/sessions/active-session.json`.
 *  Avoids scanning all session folders on startup — read this one file
 *  to find the active session, then read that session's context.json. */
export interface ActiveSessionPointer {
  activeSessionId: string;
}

// PrereqOutput, BuildRequirements, CloudSdkSwap → see azure-app-onboard-prereq/references/prereq-schemas.ts