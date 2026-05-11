/**
 * Scaffold + deploy artifact schemas — companion to session-schemas.ts.
 *
 * Split from session-schemas.ts to reduce agent read overhead. This file
 * contains types for scaffold-manifest.json and deploy-result.json.
 * Shared domain types (AppOnboardContext, PrereqOutput, PreparePlan) remain in
 * session-schemas.ts.
 */

// ─── Shared type (used by DeployEndpoint + DeployResult) ─────────────────────

export type HealthStatus = "healthy" | "degraded" | "unreachable" | "unknown";

// ─── Scaffold healing types ──────────────────────────────────────────────────

export type ScaffoldErrorClassification = "FIXABLE" | "BLOCKING";
export type ScaffoldHealingResult = "fixed" | "still-failing" | "blocked";

export interface ScaffoldHealingError {
  check: string;
  detail: string;
  classification: ScaffoldErrorClassification;
}

export interface ScaffoldHealingFix {
  file: string;
  change: string;
  reason: string;
}

export interface ScaffoldHealingAttempt {
  attempt: number;
  errors: ScaffoldHealingError[];
  fixes: ScaffoldHealingFix[];
  result: ScaffoldHealingResult;
  /** True when this healing attempt changed the service type or region — requires re-approval */
  planLevelChange?: boolean;
  /** Original service before the pivot (e.g., "App Service B1") */
  originalService?: string;
  /** New service after the pivot (e.g., "Container Apps Consumption") */
  newService?: string;
}

// ─── Deploy healing types ────────────────────────────────────────────────────

export type DeployErrorClassification = "IAC_ERROR" | "INFRA_TRANSIENT" | "ENVIRONMENT_BLOCKING";
export type DeployHealingPhase = "validation" | "deployment";

/** Tracks a resource group created during a healing attempt that is no longer
 *  the final deployment target. Surfaced at handoff for manual cleanup. */
export interface OrphanResourceGroup {
  /** Azure resource group name */
  name: string;
  /** Region where the RG was created */
  region: string;
  /** Which healing attempt created or targeted this RG */
  healingAttempt: number;
  /** Why this RG was abandoned (e.g., "region fallback to westus2") */
  reason: string;
}
export type DeployHealingAction = "routed-to-scaffold" | "retried" | "surfaced-to-user";
export type DeployHealingResult = "fixed" | "still-failing" | "blocked";

export interface DeployHealingError {
  source: string;
  detail: string;
  classification: DeployErrorClassification;
}

export interface DeployHealingAttempt {
  attempt: number;
  phase: DeployHealingPhase;
  errors: DeployHealingError[];
  action: DeployHealingAction;
  result: DeployHealingResult;
  /** Resource group targeted by this attempt — useful for audit and debugging */
  resourceGroupName?: string;
  /** True when this healing attempt changed the service type or region — requires re-approval */
  planLevelChange?: boolean;
  /** What changed: "service-type", "region", "sku" */
  changeType?: "service-type" | "region" | "sku";
  /** Original value before the change (e.g., "App Service B1 eastus") */
  originalValue?: string;
  /** New value after the change (e.g., "Container Apps Consumption eastus") */
  newValue?: string;
}

// ─── scaffold-manifest.json ──────────────────────────────────────────────────

export type SelfReviewRating = "VERIFIED" | "PLAUSIBLE" | "FLAGGED";

export interface ScaffoldFile {
  path: string;
  type: string;
}

export interface SelfReviewFinding {
  layer: number;
  claim: string;
  rating: SelfReviewRating;
  detail: string;
}

export type IacFormat = "bicep" | "terraform";

export interface ScaffoldBranchInfo {
  branch: string;
  prUrl?: string;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface ValidationResult {
  status: "Validated" | "Partial" | "Failed";
  checks: ValidationCheck[];
  proof?: string;
}

export interface ScaffoldManifest {
  iacFormat: IacFormat;
  files: ScaffoldFile[];
  selfReview: {
    findings: SelfReviewFinding[];
    healingAttempts?: readonly ScaffoldHealingAttempt[];
  };
  validationResult?: ValidationResult;
  branchInfo?: ScaffoldBranchInfo;
}

// ─── deploy-result.json ──────────────────────────────────────────────────────

export interface DeployEndpoint {
  name: string;
  url: string;
  healthStatus: HealthStatus;
}

export interface DeployDuration {
  totalSeconds: number;
  startedUtc: string;
  completedUtc: string;
}

export type DeployStatus = "in-progress" | "succeeded" | "failed";

export type ResourceDeployStatus = "succeeded" | "failed" | "skipped";

export interface ResourceResult {
  resourceId: string;
  type: string;
  status: ResourceDeployStatus;
  error?: string;
}

export interface DeployResult {
  sessionId: string;
  /** All ARM deployment names used during this session (initial + healing retries).
   *  First entry is the initial deployment; subsequent entries are from scope/RG changes. */
  deploymentNames: string[];
  resourceGroupName: string;
  status: DeployStatus;
  resourceIds: string[];
  endpoints: DeployEndpoint[];
  healthStatus: HealthStatus;
  duration: DeployDuration;
  warnings: string[];
  partial: boolean;
  resourceResults: readonly ResourceResult[];
  /** RGs created during healing that are not the final deployment target.
   *  Surfaced at handoff (Step 9) with manual cleanup commands. */
  orphanedResourceGroups: readonly OrphanResourceGroup[];
  healingAttempts?: readonly DeployHealingAttempt[];
}
