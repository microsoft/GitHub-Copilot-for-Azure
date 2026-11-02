import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
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

async function uploadReports(client: ContainerClient, prefix: string): Promise<void> {
  const group = required("REPORT_GROUP");
  if (!/^[a-z0-9-]+$/.test(group)) {
    throw new Error(`Invalid report group: ${group}`);
  }
  const sourceFiles = ["permission-run.json"];
  if (existsSync("reports")) {
    sourceFiles.push(...files("reports"));
  }
  for (const file of sourceFiles) {
    await client.getBlockBlobClient(`${prefix}${group}/${file.split(path.sep).join("/")}`)
      .uploadFile(file);
  }
}

async function downloadReports(client: ContainerClient, prefix: string, key: string, attempt: string): Promise<void> {
  for await (const blob of client.listBlobsFlat({ prefix })) {
    const [group, ...parts] = blob.name.slice(prefix.length).split("/");
    if (!/^[a-z0-9-]+$/.test(group) || parts.length === 0
      || parts.some(part => !part || part === "." || part === ".." || part.includes("\\"))) {
      throw new Error(`Invalid report blob path: ${blob.name}`);
    }
    const destination = path.join("permission-artifacts", `integration-${key}-${group}-${attempt}`, ...parts);
    mkdirSync(path.dirname(destination), { recursive: true });
    await client.getBlockBlobClient(blob.name).downloadToFile(destination);
  }
}

async function publishReports(client: ContainerClient, run: string, skill: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  for (const file of files("reports/test-run-all-integration")) {
    const relative = path.relative("reports/test-run-all-integration", file).split(path.sep).join("/");
    await client.getBlockBlobClient(`${date}/${run}/${skill.split("/")[1]}/${relative}`).uploadFile(file);
  }
}

export async function transferReports(command: string): Promise<void> {
  const account = required("REPORT_STORAGE_ACCOUNT");
  const container = required("REPORT_STORAGE_CONTAINER");
  const skill = required("SKILL");
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(skill)) {
    throw new Error(`Invalid skill reference: ${skill}`);
  }
  const run = required("RUN_ID");
  const attempt = required("RUN_ATTEMPT");
  if (!/^\d+$/.test(run) || !/^\d+$/.test(attempt)) {
    throw new Error("RUN_ID and RUN_ATTEMPT must be numeric");
  }
  const key = skill.replace("/", "__");
  const prefix = `workflow-runs/${run}/${attempt}/${key}/`;
  const client = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`, createStageCredential(),
  ).getContainerClient(container);
  if ((await client.getProperties()).blobPublicAccess) {
    throw new Error("Report container must not allow public access");
  }

  switch (command) {
    case "upload":
      return uploadReports(client, prefix);
    case "download":
      return downloadReports(client, prefix, key, attempt);
    case "publish":
      return publishReports(client, run, skill);
    default:
      throw new Error(`Unsupported report transfer command: ${command}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await transferReports(process.argv[2]);
}
