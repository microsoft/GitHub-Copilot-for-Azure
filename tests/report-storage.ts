import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { readdirSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { createStageCredential } from "./utils/azure-environment.ts";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return files(file);
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported report file: ${file}`);
    }
    return [file];
  });
}

async function publishReports(client: ContainerClient, run: string, skill: string, group: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const prefix = `${date}/${run}/${skill.split("/")[1]}/${group ? `${group}/` : ""}`;
  for (const file of files("reports/test-run-all-integration")) {
    const relative = path.relative("reports/test-run-all-integration", file).split(path.sep).join("/");
    await client.getBlockBlobClient(`${prefix}${relative}`).uploadFile(file);
  }
}

export async function publishLocalReports(): Promise<void> {
  const account = required("REPORT_STORAGE_ACCOUNT");
  const container = required("REPORT_STORAGE_CONTAINER");
  const skill = required("SKILL");
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(skill)) {
    throw new Error(`Invalid skill reference: ${skill}`);
  }
  const run = required("RUN_ID");
  if (!/^\d+$/.test(run)) {
    throw new Error("RUN_ID must be numeric");
  }
  const group = process.env.REPORT_GROUP ?? "";
  if (group && !/^[a-z0-9-]+$/.test(group)) {
    throw new Error(`Invalid report group: ${group}`);
  }
  const client = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`, createStageCredential(),
  ).getContainerClient(container);
  if ((await client.getProperties()).blobPublicAccess) {
    throw new Error("Report container must not allow public access");
  }

  await publishReports(client, run, skill, group);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await publishLocalReports();
}
