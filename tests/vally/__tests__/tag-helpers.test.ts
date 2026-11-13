import { describe, expect, test } from "vitest";
import { compileEarlyTerminatePattern, getAzureEnvironment } from "../tag-helpers.ts";

describe("getAzureEnvironment", () => {
  const env = {
    CI: "true",
    TEST_PERMISSION: "",
    AZURE_READ_CLIENT_ID: "read-client",
    AZURE_WRITE_CLIENT_ID: "write-client",
    AZURE_ADMIN_CLIENT_ID: "admin-client",
    AZURE_CLIENT_ID: "default-client",
    AZURE_READ_CONFIG_DIR: "/tmp/azure-read",
    AZURE_WRITE_CONFIG_DIR: "/tmp/azure-write",
    AZURE_ADMIN_CONFIG_DIR: "/tmp/azure-admin",
    AZURE_NONE_CONFIG_DIR: "/tmp/azure-none",
    AZD_READ_CONFIG_DIR: "/tmp/azd-read",
    AZD_WRITE_CONFIG_DIR: "/tmp/azd-write",
    AZD_ADMIN_CONFIG_DIR: "/tmp/azd-admin",
    AZD_NONE_CONFIG_DIR: "/tmp/azd-none",
  };

  test.each([undefined, "", "false", "true"])("preserves credentials without opt-in when CI is %j", (ci) => {
    expect(getAzureEnvironment({ azurePermission: "read" }, { ...env, CI: ci, TEST_PERMISSION: undefined }))
      .toEqual({});
    expect(getAzureEnvironment(undefined, { CI: ci })).toEqual({});
  });

  test.each([undefined, "", "false"])("preserves credentials outside CI when CI is %j", (ci) => {
    expect(getAzureEnvironment({ azurePermission: "read" }, { ...env, CI: ci })).toEqual({});
  });

  test.each(["read", "write", "admin", "none"])("selects independent az and azd profiles for %s", (permission) => {
    const parentEnv = { ...env };
    expect(getAzureEnvironment({ azurePermission: permission }, parentEnv)).toEqual({
      AZURE_CLIENT_ID: permission === "none" ? "" : `${permission}-client`,
      AZURE_CONFIG_DIR: `/tmp/azure-${permission}`,
      AZD_CONFIG_DIR: `/tmp/azd-${permission}`,
    });
    expect(parentEnv).toEqual(env);
  });

  test("uses admin for untagged tests, never the stage identity", () => {
    expect(getAzureEnvironment(undefined, env)).toEqual({
      AZURE_CLIENT_ID: "admin-client", AZURE_CONFIG_DIR: "/tmp/azure-admin", AZD_CONFIG_DIR: "/tmp/azd-admin",
    });
  });

  test.each(["read", "write", "admin"])("requires the %s client ID even if another identity is available", (permission) => {
    for (const clientId of [undefined, "", "   "]) {
      expect(() => getAzureEnvironment({ azurePermission: permission }, {
        ...env, [`AZURE_${permission.toUpperCase()}_CLIENT_ID`]: clientId,
      })).toThrow(`Missing Azure client ID for ${permission}`);
    }
    expect(getAzureEnvironment({ azurePermission: permission }, {
      ...env, [`AZURE_${permission.toUpperCase()}_CLIENT_ID`]: "  selected-client  ",
    }).AZURE_CLIENT_ID).toBe("selected-client");
  });

  test.each(["read", "write", "admin", "none"])("rejects missing or relative %s profiles for both CLIs", (permission) => {
    for (const prefix of ["AZURE", "AZD"]) {
      for (const directory of [undefined, "", "relative/profile"]) {
        const variable = `${prefix}_${permission.toUpperCase()}_CONFIG_DIR`;
        expect(() => getAzureEnvironment({ azurePermission: permission }, {
          ...env, [variable]: directory,
        })).toThrow(variable);
      }
    }
  });

  test.each(["reed", "", ["read"], ["none"]])("rejects unsupported permission tags: %j", (permission) => {
    expect(() => getAzureEnvironment({ azurePermission: permission }, env)).toThrow("tags.azurePermission");
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
    expect(compileEarlyTerminatePattern("(?i:ready to proceed|ready to deploy)").test("READY TO DEPLOY")).toBe(true);
  });
  test("rejects unsupported inline flags", () => {
    expect(() => compileEarlyTerminatePattern("(?x)^bash$")).toThrow();
  });
});
