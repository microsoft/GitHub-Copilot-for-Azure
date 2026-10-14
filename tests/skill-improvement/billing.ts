export type AnswerBilling = {
  source: "copilot_usage.totalNanoAiu";
  requests: number;
  billedRequests: number;
  billedAiCredits: number | null;
};

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
