export const NANO_AIU_PER_AI_CREDIT = 1_000_000_000;

function validateNanoAiu(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${field} billing value.`);
  }
  return value;
}

/** SDK-reported consumption for one evaluation answer trajectory, which may contain many model calls. */
export type EvaluationAnswerBilling = {
  source: "copilot_usage.totalNanoAiu";
  /** Received assistant.usage events, not independently verified requests; interrupted calls may emit none. */
  usageEvents: number;
  /** Received usage events containing valid provider billing, including explicitly reported zero. */
  usageEventsWithBilling: number;
  /** Sum of available request billing, including partial or interrupted sessions; null means none reported. */
  reportedAiCredits: number | null;
  /** Complete provider-reported consumption, not invoice charges; null unless session and billing are complete. */
  completeAiCredits: number | null;
  /** Why complete consumption is unavailable; omitted for complete measurements. */
  reason?: string;
};

/**
 * Summary for one cost category: evaluation answers or improvement-agent invocations.
 * Counts are derived by the runner, not returned by the SDK or CLI.
 */
export type BillingCategorySummary = {
  /** Entity counted by expected, observed, and measured; not individual model requests. */
  unit: "answer trajectories" | "agent invocations";
  /**
   * Planned count: sum of stimuli * repetitions across conditions, answer models, and eval files;
   * one per improvement-agent invocation. Judges do not multiply this count; zero means not applicable.
   */
  expected: number;
  /** Recovered Vally answer records or accounted-for CLI invocations; does not imply success or billing. */
  observed: number;
  /** Answers with completeAiCredits, or finalized CLI invocations with provider billing status "complete". */
  fullyMeasured: number;
  /** Sum of AI credits for fully measured entities only; zero does not imply missing entities were free. */
  fullyMeasuredAiCredits: number;
  /**
   * Available credits from complete and incomplete entities; null means none reported.
   * Includes fullyMeasuredAiCredits, so never add the two fields together.
   */
  reportedAiCredits: number | null;
  /** Billing field/provenance, or a marker such as "not applicable" or "mixed" for aggregates. */
  source: string;
  /** Optional diagnostic explaining unavailable or incomplete billing, not a test-failure reason. */
  reason?: string;
};

/** Groups cost categories for a named evaluation or improvement phase. */
export type PhaseBilling = {
  phase: string;
  /** Aggregates per-answer SDK billing into trajectory counts and credit totals. */
  evaluationAnswers: BillingCategorySummary;
  /** Accounts for improvement-agent CLI usage, separately from evaluation answers. */
  skillImprovement: BillingCategorySummary;
  /** Whether the runner finished accounting for this phase; unrelated to candidate acceptance. */
  finalized: boolean;
};

export function emptyBilling(
  unit: BillingCategorySummary["unit"],
  expected: number,
  source: string,
  reason?: string,
): BillingCategorySummary {
  return { unit, expected, observed: 0, fullyMeasured: 0, fullyMeasuredAiCredits: 0,
    reportedAiCredits: null, source, reason };
}

export function isBillingComplete(billing: BillingCategorySummary): boolean {
  return billing.observed === billing.expected && billing.fullyMeasured === billing.expected;
}

export function collectSkillImprovementBilling(
  usage: unknown,
  finalized: boolean,
): BillingCategorySummary {
  const billing = emptyBilling(
    "agent invocations", 1, "copilot_cli.usage_output.totalNanoAiu",
    "Missing CLI usage export."
  );
  // Account for this invocation even if its usage export is missing.
  billing.observed = 1;
  if (!usage || typeof usage !== "object") {
    return billing;
  }
  billing.reason = "CLI usage export has no AI-credit aggregate.";
  if ("totalNanoAiu" in usage && usage.totalNanoAiu !== undefined) {
    const value = validateNanoAiu(usage.totalNanoAiu, "improvement-agent totalNanoAiu");
    const status = "aiCreditsStatus" in usage ? usage.aiCreditsStatus : undefined;
    billing.reason = status === "partial" ? "Provider reported partial billing."
      : status === "complete" ? "CLI invocation not finalized."
        : "Provider billing status is unknown or unavailable.";
    if ("aiCreditsStatus" in usage
      && (usage.aiCreditsStatus === "complete" || usage.aiCreditsStatus === "partial")) {
      billing.reportedAiCredits = value / NANO_AIU_PER_AI_CREDIT;
    }
    if (finalized && "aiCreditsStatus" in usage && usage.aiCreditsStatus === "complete") {
      billing.fullyMeasured = 1;
      billing.fullyMeasuredAiCredits = value / NANO_AIU_PER_AI_CREDIT;
      delete billing.reason;
    }
  }
  return billing;
}

export function collectEvaluationAnswerBilling(
  events: readonly {
    type: string;
    data: unknown;
  }[],
  completed: boolean,
): EvaluationAnswerBilling {
  // Sum request usage only; adding the shutdown aggregate would count consumption twice.
  const usageEvents = events.filter(event => event.type === "assistant.usage");
  let nanoAiu = 0;
  let usageEventsWithBilling = 0;
  for (const event of usageEvents) {
    const data = event.data;
    if (!data || typeof data !== "object" || !("copilotUsage" in data)
      || data.copilotUsage === undefined) {
      continue;
    }
    const usage = data.copilotUsage;
    if (!usage || typeof usage !== "object" || !("totalNanoAiu" in usage)) {
      throw new Error("Invalid copilot_usage billing data.");
    }
    const value = validateNanoAiu(usage.totalNanoAiu, "copilot_usage.totalNanoAiu");
    nanoAiu += value;
    if (!Number.isSafeInteger(nanoAiu)) {
      throw new Error("Answer billing total exceeds safe integer precision.");
    }
    usageEventsWithBilling++;
  }
  const reason = !completed ? "Session not completed; additional usage may be missing."
    : usageEvents.length === 0 ? "No usage events received."
      : usageEventsWithBilling !== usageEvents.length
        ? `${usageEvents.length - usageEventsWithBilling} of ${usageEvents.length} usage events lack billing.`
        : undefined;
  return {
    source: "copilot_usage.totalNanoAiu",
    usageEvents: usageEvents.length,
    usageEventsWithBilling,
    reportedAiCredits: usageEventsWithBilling > 0 ? nanoAiu / NANO_AIU_PER_AI_CREDIT : null,
    completeAiCredits: !reason
      ? nanoAiu / NANO_AIU_PER_AI_CREDIT
      : null,
    ...(reason ? { reason } : {}),
  };
}
