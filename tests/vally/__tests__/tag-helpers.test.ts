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
  };

  test.each([undefined, "", "false", "true"])("preserves credentials without TEST_PERMISSION when CI is %j", (ci) => {
    for (const permission of ["read", "write", "admin", "none", "unsupported"]) {
      expect(getAzureEnvironment({ azurePermission: permission }, {
        ...env, CI: ci, TEST_PERMISSION: undefined, TEST_AZURE_PERMISSION: "none",
      })).toEqual({});
      expect(getAzureEnvironment({ azurePermission: permission }, { CI: ci })).toEqual({});
    }
    expect(getAzureEnvironment(undefined, { CI: ci })).toEqual({});
  });

  test.each([undefined, "", "false", "true"])("selects explicit credentials with TEST_PERMISSION when CI is %j", (ci) => {
    expect(getAzureEnvironment({ azurePermission: "read" }, { ...env, CI: ci, TEST_PERMISSION: "read" }))
      .toEqual({ AZURE_CLIENT_ID: "read-client", AZURE_CONFIG_DIR: "/tmp/azure-read" });
    expect(getAzureEnvironment({ azurePermission: "none" }, { ...env, CI: ci, TEST_PERMISSION: "none" }))
      .toEqual({ AZURE_CLIENT_ID: "", AZURE_CONFIG_DIR: "/tmp/azure-none" });
    expect(getAzureEnvironment(undefined, { ...env, CI: ci }))
      .toEqual({ AZURE_CLIENT_ID: "admin-client", AZURE_CONFIG_DIR: "/tmp/azure-admin" });
  });

  test("uses admin for untagged tests, never the stage identity", () => {
    for (const tags of [undefined, { area: "routing" }]) {
      expect(getAzureEnvironment(tags, env)).toEqual({
        AZURE_CLIENT_ID: "admin-client", AZURE_CONFIG_DIR: "/tmp/azure-admin",
      });
    }
    expect(getAzureEnvironment(undefined, { ...env, TEST_PERMISSION: "none" })).toEqual({
      AZURE_CLIENT_ID: "", AZURE_CONFIG_DIR: "/tmp/azure-none",
    });
  });

  test.each(["read", "write", "admin"])("selects the %s client ID without changing the parent environment", (permission) => {
    const parentEnv = { ...env };
    expect(getAzureEnvironment({ azurePermission: permission }, parentEnv)).toEqual({
      AZURE_CLIENT_ID: `${permission}-client`,
      AZURE_CONFIG_DIR: `/tmp/azure-${permission}`,
    });
    expect(parentEnv).toEqual(env);
  });

  test.each(["read", "write", "admin"])("selects the tagged identity in a matching %s job", (permission) => {
    expect(getAzureEnvironment({ azurePermission: permission }, {
      ...env,
      TEST_AZURE_PERMISSION: permission,
    })).toEqual({
      AZURE_CLIENT_ID: `${permission}-client`,
      AZURE_CONFIG_DIR: `/tmp/azure-${permission}`,
    });
  });

  test("uses admin for the default permission job", () => {
    expect(getAzureEnvironment(undefined, { ...env, TEST_AZURE_PERMISSION: "" })).toEqual({
      AZURE_CLIENT_ID: "admin-client", AZURE_CONFIG_DIR: "/tmp/azure-admin",
    });
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
      })).toThrow(`Missing Azure client ID for ${permission}`);
    }
  });

  test("clears the client ID in a none job", () => {
    expect(getAzureEnvironment({ azurePermission: "none" }, {
      ...env, TEST_AZURE_PERMISSION: "none",
    })).toEqual({ AZURE_CLIENT_ID: "", AZURE_CONFIG_DIR: "/tmp/azure-none" });
  });

  test.each([env, { TEST_PERMISSION: "none", AZURE_NONE_CONFIG_DIR: "/tmp/azure-none" }])("uses an unauthenticated profile for none: %j", (parentEnv) => {
    expect(getAzureEnvironment({ azurePermission: "none" }, parentEnv))
      .toEqual({ AZURE_CLIENT_ID: "", AZURE_CONFIG_DIR: "/tmp/azure-none" });
  });

  test.each(["read", "write", "admin"])("trims the %s client ID", (permission) => {
    expect(getAzureEnvironment({ azurePermission: permission }, {
      ...env,
      [`AZURE_${permission.toUpperCase()}_CLIENT_ID`]: "  selected-client  ",
    })).toEqual({ AZURE_CLIENT_ID: "selected-client", AZURE_CONFIG_DIR: `/tmp/azure-${permission}` });
  });

  test.each(["read", "write", "admin", "none"])("rejects a missing or relative %s profile", (permission) => {
    for (const directory of [undefined, "", "relative/profile"]) {
      expect(() => getAzureEnvironment({ azurePermission: permission }, {
        ...env,
        [`AZURE_${permission.toUpperCase()}_CONFIG_DIR`]: directory,
      })).toThrow("must be an absolute Azure CLI profile path");
    }
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
