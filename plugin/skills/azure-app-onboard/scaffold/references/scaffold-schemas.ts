/**
 * Scaffold artifact schema — scaffold-manifest.json.
 * Read by scaffold refs (validation-and-manifest.md, scaffold-healing-rules.md, iac-generation-rules.md).
 */

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

// ─── scaffold-manifest.json ──────────────────────────────────────────────────

export type SelfReviewRating = "VERIFIED" | "PLAUSIBLE" | "FLAGGED";

export interface ScaffoldFile {
  path: string;
  type: string;
}

export interface SelfReviewFinding {
  layer: string; // "L1" | "L2" | "L3" | "L4"
  claim: string;
  rating: SelfReviewRating;
  detail: string;
}

export type IacFormat = "bicep" | "terraform";

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
}
