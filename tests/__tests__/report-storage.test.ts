import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { publishLocalReports } from "../report-storage.ts";

const storage = vi.hoisted(() => ({
  blobs: new Map<string, Buffer>(),
  publicAccess: undefined as string | undefined,
  credential: { getToken: vi.fn() },
  failUpload: false,
}));
vi.mock("../utils/azure-environment.ts", () => ({
  createStageCredential: () => storage.credential,
}));
vi.mock("@azure/storage-blob", () => ({
  BlobServiceClient: class {
    constructor(_url: string, credential: unknown) {
      expect(credential).toBe(storage.credential);
    }
    getContainerClient() {
      return {
        getProperties: async () => ({ blobPublicAccess: storage.publicAccess }),
        getBlockBlobClient: (name: string) => ({
          uploadFile: async (file: string) => {
            if (storage.failUpload) {
              throw new Error("storage upload failed");
            }
            storage.blobs.set(name, readFileSync(file));
          },
        }),
      };
    }
  },
}));

describe("direct private report publication", () => {
  let directory: string;
  const cwd = process.cwd();
  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "report-storage-"));
    process.chdir(directory);
    storage.blobs.clear();
    storage.publicAccess = undefined;
    storage.failUpload = false;
    for (const [name, value] of Object.entries({
      SKILL: "plugin/skill", RUN_ID: "123", REPORT_GROUP: "",
      REPORT_STORAGE_ACCOUNT: "stage", REPORT_STORAGE_CONTAINER: "reports",
    })) {
      vi.stubEnv(name, value);
    }
    mkdirSync("reports/test-run-all-integration/test", { recursive: true });
    writeFileSync("reports/test-run-all-integration/testResults.json", '{"test":{"isPass":true}}');
    writeFileSync("reports/test-run-all-integration/test/.hidden", "preserved");
    mkdirSync("results");
    writeFileSync("results/private.jsonl", "raw");
  });
  afterEach(() => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  });

  test.each(["", "deployment-category"])("publishes local reports directly with group '%s'", async (group) => {
    vi.stubEnv("REPORT_GROUP", group);
    await publishLocalReports();
    const prefix = `${new Date().toISOString().slice(0, 10)}/123/skill/${group ? `${group}/` : ""}`;
    expect([...storage.blobs.keys()]).toEqual([
      `${prefix}test/.hidden`, `${prefix}testResults.json`,
    ]);
    expect(storage.blobs.get(`${prefix}test/.hidden`)?.toString()).toBe("preserved");
  });

  test("rejects public containers", async () => {
    storage.publicAccess = "blob";
    await expect(publishLocalReports()).rejects.toThrow("must not allow public access");
    expect(storage.blobs.size).toBe(0);
  });

  test("surfaces upload failures", async () => {
    storage.failUpload = true;
    await expect(publishLocalReports()).rejects.toThrow("storage upload failed");
  });

  test.each([
    ["REPORT_GROUP", "../escape"], ["SKILL", "../skill"], ["RUN_ID", "not-a-number"],
  ])("rejects invalid %s", async (variable, value) => {
    vi.stubEnv(variable, value);
    await expect(publishLocalReports()).rejects.toThrow();
    expect(storage.blobs.size).toBe(0);
  });
});
