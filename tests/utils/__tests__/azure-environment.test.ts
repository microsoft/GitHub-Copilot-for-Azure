import { afterEach, describe, expect, test, vi } from "vitest";
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
  test("fixture commands always use write, never the inherited stage or agent profile", () => {
    vi.stubEnv("CI", "true");
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
    vi.stubEnv("AZURE_STAGE_CONFIG_DIR", "/tmp/stage");
    vi.stubEnv("AZURE_STAGE_CLIENT_ID", "stage-client");
    vi.stubEnv("AZURE_WRITE_CONFIG_DIR", undefined);
    expect(() => createWriteCredential()).toThrow("AZURE_WRITE_CONFIG_DIR");
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  test("CI never falls back to default Azure credentials when a profile is absent", () => {
    expect(() => getProfileEnvironment("stage", { CI: "true" })).toThrow("AZURE_STAGE_CONFIG_DIR");
    expect(() => getProfileEnvironment("write", { CI: "true" })).toThrow("AZURE_WRITE_CONFIG_DIR");
  });
});
