import { describe, expect, test } from "vitest";
import { compileEarlyTerminatePattern, getAzureEnvironment } from "../tag-helpers.ts";

describe("getAzureEnvironment", () => {
  const env = {
    CI: "true",
    AZURE_READ_CONFIG_DIR: "/tmp/azure-read",
    AZURE_READ_CLIENT_ID: "read-client",
    AZURE_CONFIG_DIR: "/tmp/azure-admin",
    AZURE_CLIENT_ID: "admin-client",
  };

  test.each([undefined, "", "false"])("preserves local credentials when CI is %j", (ci) => {
    expect(getAzureEnvironment({ azurePermission: "read" }, { ...env, CI: ci })).toEqual({});
    expect(getAzureEnvironment({ azurePermission: "read" }, { CI: ci })).toEqual({});
    expect(getAzureEnvironment({ azurePermission: "unsupported" }, { CI: ci })).toEqual({});
  });

  test("preserves the inherited identity for untagged tests", () => {
    expect(getAzureEnvironment(undefined, env)).toEqual({});
    expect(getAzureEnvironment({ area: "routing" }, env)).toEqual({});
  });

  test("selects the read profile without changing the parent environment", () => {
    expect(getAzureEnvironment({ azurePermission: "read" }, env)).toEqual({
      AZURE_CONFIG_DIR: "/tmp/azure-read",
      AZURE_CLIENT_ID: "read-client",
    });
    expect(env.AZURE_CONFIG_DIR).toBe("/tmp/azure-admin");
    expect(env.AZURE_CLIENT_ID).toBe("admin-client");
  });

  test.each([
    {},
    { AZURE_READ_CLIENT_ID: "read-client" },
    { AZURE_READ_CONFIG_DIR: "/tmp/azure-read" },
    { AZURE_READ_CONFIG_DIR: "relative/profile", AZURE_READ_CLIENT_ID: "read-client" },
    { AZURE_READ_CONFIG_DIR: " ", AZURE_READ_CLIENT_ID: "read-client" },
  ])("fails closed when read credentials are not configured: %j", (missingEnv) => {
    expect(() => getAzureEnvironment({ azurePermission: "read" }, { ...missingEnv, CI: "true" }))
      .toThrow("refusing to use the default Azure identity");
  });

  test.each(["admin", "write", "none", "reed", "", ["read"]])("rejects unsupported permission tags: %j", (permission) => {
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
