import { afterEach, describe, expect, test, vi } from "vitest";
import { DefaultAzureCredential } from "@azure/identity";
import { createStageCredential, createWriteCredential, getProfileEnvironment } from "../azure-environment.ts";
import { runAz } from "../../azure-fixtures/fixture-common.ts";

const mocks = vi.hoisted(() => ({ execFile: vi.fn(), execFileSync: vi.fn() }));
vi.mock("node:child_process", () => ({
  execFile: mocks.execFile,
  execFileSync: mocks.execFileSync,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("isolated Azure profile consumers", () => {
  test.each([undefined, "", "false", "true"])("preserves inherited credentials when profile selection is disabled and CI is %j", (ci) => {
    for (const permission of ci === "true" ? [undefined] : [undefined, "", "read"]) {
      const env = {
        CI: ci, TEST_PERMISSION: permission,
        AZURE_CLIENT_ID: "local-client", AZURE_CONFIG_DIR: "/tmp/local",
      };
      const selected = getProfileEnvironment("read", env);
      expect(selected).toEqual(env);
      expect(selected).not.toBe(env);
    }
  });

  test.each(["stage", "write"] as const)("%s SDK authentication uses default credentials when profile selection is disabled", (profile) => {
    for (const ci of [undefined, "", "false", "true"]) {
      for (const permission of ci === "true" ? [undefined] : [undefined, "", "read"]) {
        vi.stubEnv("CI", ci);
        vi.stubEnv("TEST_PERMISSION", permission);
        const credential = profile === "stage" ? createStageCredential() : createWriteCredential();
        expect(credential).toBeInstanceOf(DefaultAzureCredential);
      }
    }
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  test("fixture commands always use write, never the inherited stage or agent profile", () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("TEST_PERMISSION", "");
    vi.stubEnv("AZURE_CONFIG_DIR", "/tmp/stage");
    vi.stubEnv("AZURE_WRITE_CONFIG_DIR", "/tmp/write");
    vi.stubEnv("AZURE_WRITE_CLIENT_ID", "writer");
    mocks.execFileSync.mockReturnValue("ok\n");
    expect(runAz(["group", "list"])).toBe("ok");
    expect(mocks.execFileSync.mock.calls[0][2].env).toMatchObject({
      AZURE_CONFIG_DIR: "/tmp/write", AZURE_CLIENT_ID: "writer",
    });
    expect(process.env.AZURE_CONFIG_DIR).toBe("/tmp/stage");
  });

  test.each(["stage", "write"] as const)("%s SDK authentication explicitly selects its own CLI profile", async (profile) => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("TEST_PERMISSION", "");
    vi.stubEnv("AZURE_STAGE_CONFIG_DIR", "/tmp/stage");
    vi.stubEnv("AZURE_WRITE_CONFIG_DIR", "/tmp/write");
    vi.stubEnv("AZURE_WRITE_CLIENT_ID", "write-client");
    vi.stubEnv("AZURE_CONFIG_DIR", "/tmp/inherited");
    vi.stubEnv("AZURE_CLIENT_ID", "stage-client");
    vi.stubEnv("AZURE_STAGE_CLIENT_ID", "stage-client");
    mocks.execFile.mockImplementation((_command, _args, _options, callback) => {
      callback(null, JSON.stringify({ token: "stage-token", expires: "2000000000" }), "");
    });
    const credential = profile === "stage" ? createStageCredential() : createWriteCredential();
    const token = await credential.getToken("https://storage.azure.com/.default");
    expect(token).toMatchObject({ token: "stage-token", expiresOnTimestamp: 2000000000000 });
    expect(mocks.execFile.mock.calls[0][2].env).toMatchObject({
      AZURE_CONFIG_DIR: `/tmp/${profile}`, AZURE_CLIENT_ID: `${profile}-client`,
    });
    expect(process.env.AZURE_CONFIG_DIR).toBe("/tmp/inherited");
  });

  test("fixture SDK authentication cannot fall back to stage when the write profile is absent", () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("TEST_PERMISSION", "");
    vi.stubEnv("AZURE_STAGE_CONFIG_DIR", "/tmp/stage");
    vi.stubEnv("AZURE_STAGE_CLIENT_ID", "stage-client");
    vi.stubEnv("AZURE_WRITE_CONFIG_DIR", undefined);
    expect(() => createWriteCredential()).toThrow("AZURE_WRITE_CONFIG_DIR");
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  test.each(["", "read"])("CI with TEST_PERMISSION=%j requires a valid profile", (permission) => {
    const env = { CI: "true", TEST_PERMISSION: permission };
    expect(() => getProfileEnvironment("read", env)).toThrow("AZURE_READ_CONFIG_DIR");
    expect(() => getProfileEnvironment("stage", env)).toThrow("AZURE_STAGE_CONFIG_DIR");
    expect(() => getProfileEnvironment("write", env)).toThrow("AZURE_WRITE_CONFIG_DIR");
  });
});
