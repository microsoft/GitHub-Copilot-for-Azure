/**
 * Prepare-phase types: PreparePlan and supporting interfaces.
 * Split from session-schemas.ts to reduce per-phase read overhead.
 * 
 * For shared types (AppOnboardComponent, etc.), see session-schemas.ts.
 * For scaffold/deploy types, see session-schemas-deploy.ts.
 */

import { PostDeployRecommendation } from "./session-schemas";

// ─── Healing types (prepare phase) ───────────────────────────────────────────

export type PrepareHealingTrigger = "quota" | "policy" | "rubric" | "region";
export type PrepareIssueClassification = "AUTO_FIXABLE" | "NEEDS_USER_INPUT";
export type PrepareHealingResult = "fixed" | "needs-input" | "still-failing";

export interface PrepareHealingIssue {
  dimension: string;
  detail: string;
  classification: PrepareIssueClassification;
}

export interface PrepareHealingFix {
  service: string;
  change: string;
  reason: string;
}

export interface PrepareHealingAttempt {
  attempt: number;
  trigger: PrepareHealingTrigger;
  issues: PrepareHealingIssue[];
  fixes: PrepareHealingFix[];
  result: PrepareHealingResult;
}

// ─── prepare-plan.json ───────────────────────────────────────────────────────

export interface PlannedService {
  name: string;
  sku: string;
  purpose: string;
  component: string;
  region: string;
  resourceName: string;
}

export interface CostBreakdownItem {
  service: string;
  sku: string;
  monthlyUsd: number;
  note?: string;
}

export interface CostEstimate {
  monthlyUsd: number;
  currency: "USD";
  breakdown: CostBreakdownItem[];
  freeCreditsNote?: string;
  disclaimer: string;
}

export interface RejectedAlternative {
  service: string;
  reason: string;
}

export interface NamingResource {
  type: string;
  name: string;
}

export interface NamingConfig {
  pattern: string;
  /** The computed prefix used for all resource names: {project}-{env}-{suffix}.
   *  deploymentVariables.environmentName MUST equal this value. */
  resourcePrefix: string;
  resources: NamingResource[];
}

export type QuotaSource = "cli" | "fallback";

export interface QuotaCheck {
  resource: string;
  region: string;
  required: number;
  available: number;
  sufficient: boolean;
  provider: string;
  quotaName: string;
  currentUsage: number;
  currentLimit: number;
  adjustable: boolean;
  source: QuotaSource;
}

// PostDeployRecommendation → session-schemas.ts

export interface DeployStrategy {
  /** Deploy pattern: "startup-install" for native modules, undefined for Oryx auto-build */
  codeDeployPattern: "startup-install";
  /** Startup command for native module compilation (goes into appCommandLine) */
  startupCommand: string;
  /** Required app settings for the deploy strategy (e.g., SCM_DO_BUILD_DURING_DEPLOYMENT) */
  requiredAppSettings: Record<string, string>;
  /** Human-readable reason for choosing this strategy */
  reason: string;
}

export interface InstrumentationConfig {
  appInsightsEnabled: boolean;
  reason: string;
}

export interface DeploymentVariables {
  /** MUST equal naming.resourcePrefix (e.g., "myapp-dev-a1d5"), NOT the env label ("dev") */
  environmentName: string;
  location: string;
  sessionId: string;
  deployedBy: string;
  /** Variable names that could not be resolved at prepare time — deploy reads, not asks */
  deferred?: string[];
}

export interface OfferRestriction {
  /** Azure provider namespace (e.g., "Microsoft.DBforPostgreSQL") */
  provider: string;
  /** Region checked */
  region: string;
  /** Whether the offer is restricted in this region */
  restricted: boolean;
  /** Reason string from capabilities API, if any */
  reason?: string;
}

export interface QuotaValidation {
  /** True when all planned services had quota confirmed */
  verified: boolean;
  /** How quota was verified — persists in session artifact, survives context compaction */
  method?: "cli" | "what-if" | "unverifiable";
  /** The specific region that passed validation */
  verifiedRegion?: string;
  /** The specific SKU that was validated (e.g., "B1", "F1") */
  verifiedSku?: string;
  /** Regions checked during validation */
  checkedRegions?: string[];
  /** Resources that failed quota checks */
  failedResources?: string[];
  /** Reason when verified is false (e.g., "quota CLI unavailable", "all regions zero") */
  reason?: string;
  /** Offer restriction results for database services (PostgreSQL, MySQL).
   *  Populated by prepare Step 5 when database services are in the plan.
   *  `LocationIsOfferRestricted` is NOT caught by what-if — this is the only pre-deploy check. */
  offerRestrictions?: readonly OfferRestriction[];
}

export interface PreparePlan {
  services: PlannedService[];
  costEstimate: CostEstimate;
  rejectedAlternatives: RejectedAlternative[];
  naming: NamingConfig;
  quotas: readonly QuotaCheck[];
  assumptions: string[];
  postDeployRecommendations?: PostDeployRecommendation[];
  /** Instrumentation decision — object with boolean + reason, NOT a bare boolean */
  instrumentation?: InstrumentationConfig;
  /** Deployment variables resolved at prepare time — scaffold/deploy read, not re-ask */
  deploymentVariables?: DeploymentVariables;
  /** Quota validation result from proactive capacity check */
  quotaValidation?: QuotaValidation;
  /** Code deploy strategy for native module apps — see deploy-strategy.md.
   *  Only populated when Pattern B (startup-install) is needed. */
  deployStrategy?: DeployStrategy;
  healingAttempts?: readonly PrepareHealingAttempt[];
}
