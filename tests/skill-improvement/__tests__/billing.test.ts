import { describe, expect, test } from "vitest";
import { collectAnswerBilling } from "../billing.ts";

describe("answer billing", () => {
  test("sums provider billing once per request, including a measured zero", () => {
    expect(collectAnswerBilling([
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
    expect(collectAnswerBilling([]).billedAiCredits).toBeNull();
    expect(collectAnswerBilling([
      { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: 10 } } },
      { type: "assistant.usage", data: {} },
    ])).toMatchObject({ requests: 2, billedRequests: 1, billedAiCredits: null });
  });

  test.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid provider billing %s", value => {
      expect(() => collectAnswerBilling([
        { type: "assistant.usage", data: { copilotUsage: { totalNanoAiu: value } } },
      ])).toThrow("Invalid");
    }
  );
});
