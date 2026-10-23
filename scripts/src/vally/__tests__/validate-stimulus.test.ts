import { describe, expect, it } from "vitest";
import { validateAzurePermission, validateEarlyTerminatePatterns } from "../validate-stimulus.js";

describe("validateAzurePermission", () => {
  it.each([undefined, "read", "none"])("accepts supported permission %j", (value) => {
    expect(validateAzurePermission(value)).toBeUndefined();
  });

  it.each(["write", "admin", "", null, ["read"], ["none"]])("rejects unsupported permission %j", (value) => {
    expect(validateAzurePermission(value)).toBe("tags.azurePermission must be 'read' or 'none' when specified");
  });
});

describe("validateEarlyTerminatePatterns", () => {
  it("accepts JavaScript-compatible regular expressions", () => {
    const value = JSON.stringify([{
      type: "tool-call-result",
      toolPattern: "^(bash|powershell|pwsh)$",
      argsPattern: "pod-evidence\\.(sh|ps1)",
    }]);

    expect(validateEarlyTerminatePatterns(value)).toBeUndefined();
  });

  it("accepts supported leading inline regular expression flags", () => {
    const value = JSON.stringify([{
      type: "tool-call-result",
      toolPattern: "^(bash|powershell|pwsh)$",
      argsPattern: "(?i)pod-evidence\\.(sh|ps1)",
    }]);

    expect(validateEarlyTerminatePatterns(value)).toBeUndefined();
  });

  it("accepts supported whole-pattern scoped flags", () => {
    const value = JSON.stringify([{
      type: "assistant-message-match",
      contentPattern: "(?i:ready to proceed|ready to deploy)",
    }]);

    expect(validateEarlyTerminatePatterns(value)).toBeUndefined();
  });

  it("rejects unsupported inline regular expression flags", () => {
    const value = JSON.stringify([{
      type: "tool-call-result",
      toolPattern: "^(bash|powershell|pwsh)$",
      argsPattern: "(?x)pod-evidence\\.(sh|ps1)",
    }]);

    expect(validateEarlyTerminatePatterns(value)).toBe(
      "tags.earlyTerminate[0].argsPattern must be a valid JavaScript regular expression",
    );
  });
});
