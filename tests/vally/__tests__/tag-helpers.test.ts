import { describe, expect, test } from "vitest";
import { compileEarlyTerminatePattern, getQuestionOnlyInputHandler } from "../tag-helpers.ts";

describe("getQuestionOnlyInputHandler", () => {
  test("leaves existing evaluations unchanged unless opted in", () => {
    expect(getQuestionOnlyInputHandler(undefined)).toBeUndefined();
    expect(getQuestionOnlyInputHandler({})).toBeUndefined();
  });

  test("exposes questions without returning an answer or approval", () => {
    const handler = getQuestionOnlyInputHandler({ questionOnly: "true" });
    expect(handler).toBeTypeOf("function");
    if (!handler) throw new Error("Expected question-only input handling.");
    expect(() => handler({
      question: "Confirm the batch?", choices: ["Confirm these changes", "Cancel"],
    }, { sessionId: "test" })).toThrow("no user response");
  });

  test("rejects malformed opt-in values", () => {
    expect(() => getQuestionOnlyInputHandler({ questionOnly: "false" })).toThrow("questionOnly");
    expect(() => getQuestionOnlyInputHandler({ questionOnly: ["true"] })).toThrow("questionOnly");
  });
});

describe("compileEarlyTerminatePattern", () => {
  test("compiles JavaScript-compatible patterns", () => {
    expect(compileEarlyTerminatePattern("^bash$").test("bash")).toBe(true);
  });

  test("supports leading inline flags used by eval metadata", () => {
    expect(compileEarlyTerminatePattern("(?i)^bash$").test("BASH")).toBe(true);
  });

  test("supports whole-pattern scoped flags used by eval metadata", () => {
    expect(
      compileEarlyTerminatePattern("(?i:ready to proceed|ready to deploy)")
        .test("READY TO DEPLOY"),
    ).toBe(true);
  });

  test("rejects unsupported inline flags", () => {
    expect(() => compileEarlyTerminatePattern("(?x)^bash$")).toThrow();
  });
});
