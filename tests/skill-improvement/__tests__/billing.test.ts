import { describe, expect, test } from "vitest";
import { collectSkillImprovementBilling, collectEvaluationAnswerBilling, isBillingComplete } from "../billing.ts";

describe("answer billing", () => {
  test("sums provider billing once per request, including a measured zero", () => {
    expect(collectEvaluationAnswerBilling([
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 125_000_000 } } },
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 0 } } },
      { type: "session.shutdown", data: { copilotUsage: { totalNanoAiu: 125_000_000 } } },
    ])).toEqual({
      source: "copilot_usage.totalNanoAiu",
      requests: 2,
      billedRequests: 2,
      billedAiCredits: 0.125,
    });

  });

  test("does not turn absent or partial billing into a measured zero", () => {
    expect(collectEvaluationAnswerBilling([]).billedAiCredits).toBeNull();
    expect(collectEvaluationAnswerBilling([
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 10 } } },
      { type: "assistant.usage", data: {} },
    ])).toMatchObject({ requests: 2, billedRequests: 1, billedAiCredits: null });
  });

  test("does not count earlier billed requests as complete for an interrupted trajectory", () => {
    expect(collectEvaluationAnswerBilling([
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 1_250_000_000 } } },
      { type: "assistant.turn_start", data: {} },
    ], false)).toMatchObject({ requests: 1, billedRequests: 1, billedAiCredits: null });
  });

  test.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid provider billing %s", value => {
      expect(() => collectEvaluationAnswerBilling([
        { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: value } } },
      ])).toThrow("Invalid");
    }
  );

  test.each([null, "invalid", {}, { totalNanoAiu: "10" }])(
    "rejects malformed provider billing %s", copilotUsage => {
      expect(() => collectEvaluationAnswerBilling([
        { type: "assistant.usage", data: { copilotUsage } },
      ])).toThrow("Invalid");
    }
  );

  test("rejects sums that exceed safe integer precision", () => {
    expect(() => collectEvaluationAnswerBilling([
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: Number.MAX_SAFE_INTEGER } } },
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 1 } } },
    ])).toThrow("safe integer precision");
  });
});

describe("improvement-agent billing", () => {
  test("uses the final complete session aggregate once, not model/agent breakdowns", () => {
    const billing = collectSkillImprovementBilling({
      totalNanoAiu: 21_446_710_000,
      aiCreditsStatus: "complete",
      modelMetrics: { model: { totalNanoAiu: 21_446_710_000 } },
      agentMetrics: { main: { totalNanoAiu: 21_446_710_000 } },
    }, true);
    expect(billing).toMatchObject({ measured: 1, observed: 1, measuredAiCredits: 21.44671 });
    expect(isBillingComplete(billing)).toBe(true);
    expect(collectSkillImprovementBilling({ totalNanoAiu: 0, aiCreditsStatus: "complete" }, true))
      .toMatchObject({ measured: 1, measuredAiCredits: 0 });
  });

  test.each([
    undefined,
    { totalPremiumRequestCost: 1, tokenDetails: { input: { tokenCount: 10 } } },
    { totalNanoAiu: 0 },
    { totalNanoAiu: 10, aiCreditsStatus: "partial" },
    { totalNanoAiu: 10, aiCreditsStatus: "unavailable" },
  ])("does not infer complete session billing from %s", usage => {
    expect(isBillingComplete(collectSkillImprovementBilling(usage, true))).toBe(false);
  });

  test("requires finalization even when the provider aggregate is complete", () => {
    expect(collectSkillImprovementBilling({ totalNanoAiu: 10, aiCreditsStatus: "complete" }, false))
      .toMatchObject({ measured: 0, measuredAiCredits: 0 });
  });

  test.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1, "10"])(
    "rejects malformed aggregate %s", totalNanoAiu => {
      expect(() => collectSkillImprovementBilling({ totalNanoAiu, aiCreditsStatus: "complete" }, true))
        .toThrow("Invalid");
    }
  );
});
