import { describe, expect, test } from "vitest";
import { compileEarlyTerminatePattern, getAzureEnvironment } from "../tag-helpers.ts";

describe("getAzureEnvironment", () => {
  const env = {
    CI: "true",
    AZURE_READ_CLIENT_ID: "read-client",
    AZURE_WRITE_CLIENT_ID: "write-client",
    AZURE_ADMIN_CLIENT_ID: "admin-client",
    AZURE_CLIENT_ID: "default-client",
  };

  test.each([undefined, "", "false"])("preserves local credentials when CI is %j", (ci) => {
    for (const permission of ["read", "write", "admin", "none", "unsupported"]) {
      expect(getAzureEnvironment({ azurePermission: permission }, { ...env, CI: ci })).toEqual({});
      expect(getAzureEnvironment({ azurePermission: permission }, { CI: ci })).toEqual({});
    }
  });

  test("preserves the inherited identity for untagged tests", () => {
    expect(getAzureEnvironment(undefined, env)).toEqual({});
    expect(getAzureEnvironment({ area: "routing" }, env)).toEqual({});
  });

  test.each(["read", "write", "admin"])("selects the %s client ID without changing the parent environment", (permission) => {
    const parentEnv = { ...env };
    expect(getAzureEnvironment({ azurePermission: permission }, parentEnv)).toEqual({
      AZURE_CLIENT_ID: `${permission}-client`,
    });
    expect(parentEnv).toEqual(env);
  });

  test.each(["read", "write", "admin"])("selects the tagged identity in a matching %s job", (permission) => {
    expect(getAzureEnvironment({ azurePermission: permission }, {
      ...env,
      TEST_AZURE_PERMISSION: permission,
    })).toEqual({
      AZURE_CLIENT_ID: `${permission}-client`,
    });
  });

  test("preserves the inherited identity in an untagged job", () => {
    expect(getAzureEnvironment(undefined, { ...env, TEST_AZURE_PERMISSION: "" })).toEqual({});
  });

  test.each(["read", "write", "admin", "none", ""])("rejects tests belonging to a different permission job: %j", (permission) => {
    expect(() => getAzureEnvironment({ azurePermission: "read" }, {
      ...env,
      TEST_AZURE_PERMISSION: permission === "read" ? "" : permission,
    })).toThrow("does not match");
  });

  test.each(["read", "write", "admin"])("requires the %s client ID even if another identity is available", (permission) => {
    for (const clientId of [undefined, "", "   "]) {
      expect(() => getAzureEnvironment({ azurePermission: permission }, {
        ...env,
        [`AZURE_${permission.toUpperCase()}_CLIENT_ID`]: clientId,
      })).toThrow(`require AZURE_${permission.toUpperCase()}_CLIENT_ID`);
    }
  });

  test("clears the client ID in a none job", () => {
    expect(getAzureEnvironment({ azurePermission: "none" }, {
      CI: "true", TEST_AZURE_PERMISSION: "none", AZURE_CLIENT_ID: "",
    })).toEqual({ AZURE_CLIENT_ID: "" });
  });

  test.each([env, { CI: "true" }])("clears the client ID without configuring an Azure directory: %j", (parentEnv) => {
    expect(getAzureEnvironment({ azurePermission: "none" }, parentEnv))
      .toEqual({ AZURE_CLIENT_ID: "" });
  });

  test.each(["read", "write", "admin"])("trims the %s client ID", (permission) => {
    expect(getAzureEnvironment({ azurePermission: permission }, {
      CI: "true",
      [`AZURE_${permission.toUpperCase()}_CLIENT_ID`]: "  selected-client  ",
    })).toEqual({ AZURE_CLIENT_ID: "selected-client" });
  });

  test.each(["reed", "", ["read"], ["none"]])("rejects unsupported permission tags: %j", (permission) => {
    expect(() => getAzureEnvironment({ azurePermission: permission }, env))
      .toThrow("tags.azurePermission");
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
