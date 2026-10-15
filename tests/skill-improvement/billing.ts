export type AnswerBilling = {
  source: "copilot_usage.totalNanoAiu";
  requests: number;
  billedRequests: number;
  billedAiCredits: number | null;
};

export type ComponentBilling = {
  unit: "answer trajectories" | "graded trajectories" | "agent invocations";
  expected: number;
  observed: number;
  measured: number;
  measuredAiCredits: number;
  source: string;
  reason?: string;
};

export type BatchBilling = {
  batch: string;
  answers: ComponentBilling;
  judges: ComponentBilling;
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
    billedAiCredits: requests.length > 0 && billedRequests === requests.length
      ? nanoAiu / 1_000_000_000
      : null,
  };
}
