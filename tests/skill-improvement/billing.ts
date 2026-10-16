export type AnswerBilling = {
  source: "copilot_usage.totalNanoAiu";
  requests: number;
  billedRequests: number;
  billedAiCredits: number | null;
};

export type ComponentBilling = {
  /** Entity counted by expected, observed, and measured; not individual model requests. */
  unit: "answer trajectories" | "agent invocations";
  /** Planned entity count for this batch; zero means this component is not applicable. */
  expected: number;
  /** Answer records recovered or agent invocations accounted for, even without complete billing. */
  observed: number;
  /** Observed entities with complete billing (and finalization for agent invocations). */
  measured: number;
  /** Sum of AI credits for measured entities only; zero does not imply missing entities were free. */
  measuredAiCredits: number;
  /** Billing field/provenance, or a marker such as "not applicable" or "mixed" for aggregates. */
  source: string;
  /** Optional diagnostic explaining unavailable or incomplete billing, not a test-failure reason. */
  reason?: string;
};

export type BatchBilling = {
  batch: string;
  answers: ComponentBilling;
  agents: ComponentBilling;
  finalized: boolean;
};

export function emptyBilling(
  unit: ComponentBilling["unit"],
  expected: number,
  source: string,
  reason?: string,
): ComponentBilling {
  return { unit, expected, observed: 0, measured: 0, measuredAiCredits: 0, source, reason };
}

export function isBillingComplete(billing: ComponentBilling): boolean {
  return billing.observed === billing.expected && billing.measured === billing.expected;
}

export function collectAgentBilling(
  usage: unknown,
  finalized: boolean,
): ComponentBilling {
  const billing = emptyBilling(
    "agent invocations", 1, "copilot_cli.usage_output.totalNanoAiu",
    "Missing final CLI usage or incomplete provider billing."
  );
  billing.observed = 1;
  if (!usage || typeof usage !== "object") {
    return billing;
  }
  if ("totalNanoAiu" in usage && usage.totalNanoAiu !== undefined) {
    const value = usage.totalNanoAiu;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      throw new Error("Invalid improvement-agent totalNanoAiu billing value.");
    }
    if (finalized && "aiCreditsStatus" in usage && usage.aiCreditsStatus === "complete") {
      billing.measured = 1;
      billing.measuredAiCredits = value / 1_000_000_000;
      delete billing.reason;
    }
  }
  return billing;
}

export function collectAnswerBilling(
  events: readonly {
    type: string;
    data: unknown;
  }[],
  completed = true,
): AnswerBilling {
  const requests = events.filter(event => event.type === "assistant.usage");
  let nanoAiu = 0;
  let billedRequests = 0;
  for (const event of requests) {
    const data = event.data;
    if (!data || typeof data !== "object" || !("copilotUsage" in data)
      || data.copilotUsage === undefined) {
      continue;
    }
    const usage = data.copilotUsage;
    if (!usage || typeof usage !== "object" || !("totalNanoAiu" in usage)) {
      throw new Error("Invalid copilot_usage billing data.");
    }
    const value = usage.totalNanoAiu;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      throw new Error("Invalid copilot_usage.totalNanoAiu billing value.");
    }
    nanoAiu += value;
    if (!Number.isSafeInteger(nanoAiu)) {
      throw new Error("Answer billing total exceeds safe integer precision.");
    }
    billedRequests++;
  }
  return {
    source: "copilot_usage.totalNanoAiu",
    requests: requests.length,
    billedRequests,
    billedAiCredits: completed && requests.length > 0 && billedRequests === requests.length
      ? nanoAiu / 1_000_000_000
      : null,
  };
}
