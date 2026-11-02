import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { transferReports } from "../report-storage.ts";
import { aggregatePermissionResults } from "../aggregate-permission-results.ts";

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
          downloadToFile: async (file: string) => { writeFileSync(file, storage.blobs.get(name)!); },
        }),
        listBlobsFlat: async function* ({ prefix }: { prefix: string }) {
          for (const name of storage.blobs.keys()) {
            if (name.startsWith(prefix)) {
              yield { name };
            }
          }
        },
      };
    }
  },
}));

describe("private report storage", () => {
  let directory: string;
  const cwd = process.cwd();
  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "report-storage-"));
    process.chdir(directory);
    storage.blobs.clear();
    storage.publicAccess = undefined;
    storage.failUpload = false;
    for (const [name, value] of Object.entries({
      SKILL: "plugin/skill", RUN_ID: "123", RUN_ATTEMPT: "2",
      REPORT_STORAGE_ACCOUNT: "stage", REPORT_STORAGE_CONTAINER: "reports",
    })) {
      vi.stubEnv(name, value);
    }
  });
  afterEach(() => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  });

  test("round-trips permission reports and hidden files, then publishes one consolidated report", async () => {
    for (const group of ["read", "none"]) {
      const work = path.join(directory, group);
      mkdirSync(path.join(work, "reports/test-run-1", group), { recursive: true });
      mkdirSync(path.join(work, "results"), { recursive: true });
      process.chdir(work);
      vi.stubEnv("REPORT_GROUP", group);
      writeFileSync("permission-run.json", JSON.stringify({ permission: group, outcome: "success" }));
      writeFileSync("reports/test-run-1/testResults.json", JSON.stringify({ [group]: { isPass: true } }));
      writeFileSync("reports/test-run-1/results.jsonl", `${JSON.stringify({ group })}\n`);
      writeFileSync(`reports/test-run-1/${group}/.hidden`, "preserved");
      writeFileSync("results/private.jsonl", "raw");
      await transferReports("upload");
    }
    expect([...storage.blobs.keys()].some(name => name.includes("/results/private.jsonl"))).toBe(false);
    process.chdir(directory);
    await transferReports("download");
    expect(aggregatePermissionResults(
      path.join(directory, "permission-artifacts"), directory, "plugin__skill", "2", ["read", "none"],
    ).complete).toBe(true);
    expect(readFileSync("reports/test-run-all-integration/read/.hidden", "utf8")).toBe("preserved");
    await transferReports("publish");
    const report = [...storage.blobs].find(([name]) => /^\d{4}-\d{2}-\d{2}\/123\/skill\/testResults.json$/.test(name));
    expect(report).toBeDefined();
    expect(JSON.parse(report![1].toString())).toEqual({ read: { isPass: true }, none: { isPass: true } });
  });

  test("does not download reports from a different run attempt", async () => {
    storage.blobs.set("workflow-runs/123/1/plugin__skill/read/permission-run.json", Buffer.from("{}"));
    await transferReports("download");
    expect(aggregatePermissionResults(
      path.join(directory, "permission-artifacts"), directory, "plugin__skill", "2", ["read"],
    ).complete).toBe(false);
  });

  test("rejects public containers", async () => {
    storage.publicAccess = "blob";
    await expect(transferReports("download")).rejects.toThrow("must not allow public access");
  });

  test("surfaces upload failures", async () => {
    storage.failUpload = true;
    vi.stubEnv("REPORT_GROUP", "none");
    await expect(transferReports("upload")).rejects.toThrow("storage upload failed");
  });

  test("rejects blob paths that escape the report directory", async () => {
    storage.blobs.set("workflow-runs/123/2/plugin__skill/read/../../escape", Buffer.from("bad"));
    await expect(transferReports("download")).rejects.toThrow("Invalid report blob path");
  });
});
