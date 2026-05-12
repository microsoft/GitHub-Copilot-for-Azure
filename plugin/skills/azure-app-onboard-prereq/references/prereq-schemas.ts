/**
 * Prereq-phase TypeScript interfaces for prereq-output.json.
 *
 * Standalone schema for azure-app-onboard-prereq — this skill can run independently.
 *
 * Shared types used across phases (AppOnboardComponent, PostDeployRecommendation,
 * DetectedService, AppOnboardContext) are defined in:
 *   session-schemas.ts (local copy in this skill's references/)
 *
 * Context schema (AppOnboardContext, AppOnboardIntent, QuickProbeResult) is defined in:
 *   session-schemas.ts (local copy in this skill's references/)
 */

// ─── prereq-output.json ──────────────────────────────────────────────────────

export interface BuildRequirements {
  hasNativeModules: boolean;
  hasDockerfile: boolean;
  /** True when the app can deploy on App Service F1 (Free) SKU */
  f1Viable: boolean;
  /** True when Dockerfile uses BuildKit-only syntax (--mount, # syntax=docker/dockerfile:1) */
  hasBuildKitSyntax?: boolean;
  /** Port from EXPOSE directive — used for Container Apps targetPort */
  exposedPort?: number;
  /** Estimated native module compilation time in seconds (typically 30–300s;
   *  larger compiled dependencies like scipy may take 600+s).
   *  Used by deploy phase to set WEBSITES_CONTAINER_START_TIME_LIMIT. */
  estimatedInstallTime?: number;
  /** Why F1 is not viable — set when f1Viable is false.
   *  Examples: "native modules (node-gyp)", "large dependency tree (27 pinned deps)",
   *  "build-time compilation (TypeScript tsc)", "major migration (Flask 0.12→2.3)" */
  f1BlockReason?: string;
}

export interface CloudSdkSwap {
  /** The non-Azure SDK package or import (e.g., "google-cloud-pubsub", "@aws-sdk/client-dynamodb") */
  sourcePackage: string;
  /** The cloud provider: "aws" | "gcp" | "firebase" */
  sourceCloud: "aws" | "gcp" | "firebase";
  /** The Azure equivalent service (e.g., "Azure Service Bus", "Cosmos DB") */
  azureService: string;
  /** The Azure SDK package to install (e.g., "@azure/service-bus", "@azure/cosmos") */
  azurePackage: string;
  /** Which component uses this dependency */
  component: string;
}

export interface PrereqOutput {
  // AppOnboardComponent[] — see session-schemas.ts
  components: any[];
  warnings: string[];
  detectedStack: string;
  isMonorepo: boolean;
  scaffoldedFromScratch: boolean;
  /** Prereq-only: auto-approves readiness gate + simplifies prepare alt analysis.
   *  Does NOT skip any phase, gate, reference read, or validation. */
  fastTrackEligible: boolean;
  overallHealth?: "ready" | "readyWithCaveats" | "blocked";
  /** Build-time requirements detected from manifests and lockfiles */
  buildRequirements?: BuildRequirements;
  /** Structured recommendations derived from WARN findings.
   *  Merged into prepare-plan.json.postDeployRecommendations[] by the prepare phase.
   *  PostDeployRecommendation type — see session-schemas.ts */
  postDeployRecommendations?: any[];
  /** Non-Azure cloud SDK dependencies mapped to Azure equivalents.
   *  Populated by prereq when CLOUD_SDK_DEPENDENCY findings are detected.
   *  Consumed by scaffold to perform inline SDK code swaps. */
  cloudSdkSwaps?: CloudSdkSwap[];
}
