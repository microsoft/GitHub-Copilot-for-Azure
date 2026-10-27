import { describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
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
    expect(getAzureEnvironment({ azurePermission: "none" }, { ...env, CI: ci })).toEqual({});
    expect(getAzureEnvironment({ azurePermission: "none" }, { CI: ci })).toEqual({});
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

  test.each(["read", ""])("uses only the current job identity for permission %j", (permission) => {
    expect(getAzureEnvironment(permission ? { azurePermission: permission } : undefined, {
      CI: "true",
      TEST_AZURE_PERMISSION: permission,
      AZURE_CLIENT_ID: "only-client",
    })).toEqual({
      AZURE_CLIENT_ID: "only-client",
    });
  });

  test.each(["read", "none", ""])("rejects tests belonging to a different permission job: %j", (permission) => {
    expect(() => getAzureEnvironment({ azurePermission: "read" }, {
      ...env,
      TEST_AZURE_PERMISSION: permission === "read" ? "" : permission,
    })).toThrow("does not match");
  });

  test("fails closed when the isolated job identity is missing", () => {
    expect(() => getAzureEnvironment({ azurePermission: "read" }, {
      CI: "true", TEST_AZURE_PERMISSION: "read",
    })).toThrow("Permission-isolated jobs require");
  });

  test("uses the unauthenticated default profile in a none job", () => {
    expect(getAzureEnvironment({ azurePermission: "none" }, {
      CI: "true", TEST_AZURE_PERMISSION: "none", AZURE_CLIENT_ID: "",
    })).toEqual({ AZURE_CLIENT_ID: "" });
  });

  test.each([env, { CI: "true" }])("selects a unique nonexistent Azure config directory for no access: %j", (parentEnv) => {
    const first = getAzureEnvironment({ azurePermission: "none" }, parentEnv);
    const second = getAzureEnvironment({ azurePermission: "none" }, parentEnv);
    const agentEnv: NodeJS.ProcessEnv = { ...parentEnv, ...first };

    expect(Object.keys(first)).toEqual(["AZURE_CONFIG_DIR", "AZURE_CLIENT_ID"]);
    expect(first.AZURE_CLIENT_ID).toBe("");
    expect(second.AZURE_CLIENT_ID).toBe("");
    expect(agentEnv.AZURE_CLIENT_ID).toBe("");
    expect(path.isAbsolute(first.AZURE_CONFIG_DIR)).toBe(true);
    expect(path.dirname(first.AZURE_CONFIG_DIR)).toBe(tmpdir());
    expect(existsSync(first.AZURE_CONFIG_DIR)).toBe(false);
    expect(existsSync(second.AZURE_CONFIG_DIR)).toBe(false);
    expect(first.AZURE_CONFIG_DIR).not.toBe(second.AZURE_CONFIG_DIR);
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

  test.each(["admin", "write", "reed", "", ["read"], ["none"]])("rejects unsupported permission tags: %j", (permission) => {
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
