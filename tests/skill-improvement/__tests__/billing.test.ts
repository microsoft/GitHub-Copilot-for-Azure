import { describe, expect, test } from "vitest";
import { collectSkillImprovementBilling, collectEvaluationAnswerBilling, isBillingComplete } from "../billing.ts";

describe("answer billing", () => {
  test("sums provider billing once per request, including a measured zero", () => {
    expect(collectEvaluationAnswerBilling([
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 125_000_000 } } },
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 0 } } },
      { type: "session.shutdown", data: { copilotUsage: { totalNanoAiu: 125_000_000 } } },
    ], true)).toEqual({
      source: "copilot_usage.totalNanoAiu",
      usageEvents: 2,
      usageEventsWithBilling: 2,
      reportedAiCredits: 0.125,
      completeAiCredits: 0.125,
    });

  });

  test("does not turn absent or partial billing into a measured zero", () => {
    expect(collectEvaluationAnswerBilling([], true)).toMatchObject({
      completeAiCredits: null, reportedAiCredits: null,
      reason: "No usage events received.",
    });
    expect(collectEvaluationAnswerBilling([
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 10 } } },
      { type: "assistant.usage", data: {} },
    ], true)).toMatchObject({ usageEvents: 2, usageEventsWithBilling: 1, completeAiCredits: null, reportedAiCredits: 0.00000001 });
    expect(collectEvaluationAnswerBilling([
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 0 } } },
      { type: "assistant.usage", data: {} },
    ], true)).toMatchObject({ completeAiCredits: null, reportedAiCredits: 0 });
  });

  test("does not count earlier billed requests as complete for an interrupted trajectory", () => {
    expect(collectEvaluationAnswerBilling([
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 1_250_000_000 } } },
      { type: "assistant.turn_start", data: {} },
    ], false)).toMatchObject({
      usageEvents: 1, usageEventsWithBilling: 1, completeAiCredits: null, reportedAiCredits: 1.25,
      reason: "Session not completed; additional usage may be missing.",
    });
  });

  test("retains the reported 1.25-credit subtotal with four of five requests covered", () => {
    expect(collectEvaluationAnswerBilling([
      ...Array.from({ length: 4 }, () => ({
        type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 312_500_000 } },
      })),
      { type: "assistant.usage", data: {} },
    ], true)).toMatchObject({
      usageEvents: 5, usageEventsWithBilling: 4, completeAiCredits: null, reportedAiCredits: 1.25,
      reason: "1 of 5 usage events lack billing.",
    });
  });

  test.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid provider billing %s", value => {
      expect(() => collectEvaluationAnswerBilling([
        { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: value } } },
      ], true)).toThrow("Invalid");
    }
  );

  test.each([null, "invalid", {}, { totalNanoAiu: "10" }])(
    "rejects malformed provider billing %s", copilotUsage => {
      expect(() => collectEvaluationAnswerBilling([
        { type: "assistant.usage", data: { copilotUsage } },
      ], true)).toThrow("Invalid");
    }
  );

  test("rejects sums that exceed safe integer precision", () => {
    expect(() => collectEvaluationAnswerBilling([
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: Number.MAX_SAFE_INTEGER } } },
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 1 } } },
    ], true)).toThrow("safe integer precision");
  });
});

describe("improvement-agent billing", () => {
  test.each<[unknown, boolean, string]>([
    [undefined, true, "Missing CLI usage export."],
    [{}, true, "CLI usage export has no AI-credit aggregate."],
    [{ totalNanoAiu: 0 }, true, "Provider billing status is unknown or unavailable."],
    [{ totalNanoAiu: 0, aiCreditsStatus: "partial" }, true, "Provider reported partial billing."],
    [{ totalNanoAiu: 0, aiCreditsStatus: "complete" }, false, "CLI invocation not finalized."],
  ])("explains incomplete CLI accounting for %s", (usage, finalized, reason) => {
    expect(collectSkillImprovementBilling(usage, finalized).reason).toBe(reason);
  });
  test("uses the final complete session aggregate once, not model/agent breakdowns", () => {
    const billing = collectSkillImprovementBilling({
      totalNanoAiu: 21_446_710_000,
      aiCreditsStatus: "complete",
      modelMetrics: { model: { totalNanoAiu: 21_446_710_000 } },
      agentMetrics: { main: { totalNanoAiu: 21_446_710_000 } },
    }, true);
    expect(billing).toMatchObject({ fullyMeasured: 1, observed: 1, measuredAiCredits: 21.44671 });
    expect(isBillingComplete(billing)).toBe(true);
    expect(collectSkillImprovementBilling({ totalNanoAiu: 0, aiCreditsStatus: "complete" }, true))
      .toMatchObject({ fullyMeasured: 1, measuredAiCredits: 0 });
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
      .toMatchObject({ fullyMeasured: 0, measuredAiCredits: 0, reportedAiCredits: 0.00000001 });
  });

  test("preserves partial CLI aggregates without treating them as complete", () => {
    expect(collectSkillImprovementBilling({
      totalNanoAiu: 1_250_000_000, aiCreditsStatus: "partial",
    }, true)).toMatchObject({ fullyMeasured: 0, measuredAiCredits: 0, reportedAiCredits: 1.25 });
    expect(collectSkillImprovementBilling(undefined, false).reportedAiCredits).toBeNull();
    expect(collectSkillImprovementBilling({
      totalNanoAiu: 0, aiCreditsStatus: "unavailable",
    }, true).reportedAiCredits).toBeNull();
    expect(collectSkillImprovementBilling({ totalNanoAiu: 0 }, true).reportedAiCredits).toBeNull();
  });

  test.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1, "10"])(
    "rejects malformed aggregate %s", totalNanoAiu => {
      expect(() => collectSkillImprovementBilling({ totalNanoAiu, aiCreditsStatus: "complete" }, true))
        .toThrow("Invalid");
    }
  );
});
