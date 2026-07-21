/**
 * Tests for tag-helpers earlyTerminate parsing.
 */

import { getToolCallMatchTerminateConditions } from "../tag-helpers";

describe("getToolCallMatchTerminateConditions", () => {
  test("returns empty for missing tags or earlyTerminate", () => {
    expect(getToolCallMatchTerminateConditions(undefined)).toEqual([]);
    expect(getToolCallMatchTerminateConditions({})).toEqual([]);
    expect(getToolCallMatchTerminateConditions({ earlyTerminate: "" })).toEqual([]);
  });

  test("extracts only tool-call-match conditions, ignoring other types", () => {
    const earlyTerminate = JSON.stringify([
      { type: "skill-call", skill: "azure-deploy" },
      {
        type: "tool-call-match",
        toolPattern: "bash|powershell|pwsh|run_in_terminal",
        argsPattern: "validate-deployment\\.(sh|ps1)",
      },
      {
        type: "tool-call-match",
        toolPattern: "bash|powershell|pwsh|run_in_terminal",
        argsPattern: "az\\s+deployment\\b.*\\b(create|up)\\b",
      },
    ]);

    expect(getToolCallMatchTerminateConditions({ earlyTerminate })).toEqual([
      {
        toolPattern: "bash|powershell|pwsh|run_in_terminal",
        argsPattern: "validate-deployment\\.(sh|ps1)",
      },
      {
        toolPattern: "bash|powershell|pwsh|run_in_terminal",
        argsPattern: "az\\s+deployment\\b.*\\b(create|up)\\b",
      },
    ]);
  });

  test("returns empty when only non-tool-call-match conditions are present", () => {
    const earlyTerminate = JSON.stringify([
      { type: "tool-call-count", count: 3 },
      { type: "skill-call", skill: "azure-deploy" },
    ]);
    expect(getToolCallMatchTerminateConditions({ earlyTerminate })).toEqual([]);
  });

  test("returns empty on malformed JSON without throwing", () => {
    expect(getToolCallMatchTerminateConditions({ earlyTerminate: "{not json" })).toEqual([]);
  });
});
