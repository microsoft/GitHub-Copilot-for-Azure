import { describe, expect, test } from "vitest";
import { compileEarlyTerminatePattern } from "../tag-helpers.ts";

describe("compileEarlyTerminatePattern", () => {
  test("compiles JavaScript-compatible patterns", () => {
    expect(compileEarlyTerminatePattern("^bash$").test("bash")).toBe(true);
  });

  test("supports leading inline flags used by eval metadata", () => {
    expect(compileEarlyTerminatePattern("(?i)^bash$").test("BASH")).toBe(true);
  });

  test("rejects unsupported inline flags", () => {
    expect(() => compileEarlyTerminatePattern("(?x)^bash$")).toThrow();
  });
});
