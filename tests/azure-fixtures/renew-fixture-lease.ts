import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

const RENEWAL_INTERVAL_MS = 15_000;

const [accountName, containerName, blobName, leaseId] = process.argv.slice(2);
if (!accountName || !containerName || !blobName || !leaseId || !process.send) {
  process.exit(2);
}

let stopped = false;
let operation = Promise.resolve();
const serviceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  new DefaultAzureCredential(),
);
const leaseClient = serviceClient
  .getContainerClient(containerName)
  .getBlobClient(blobName)
  .getBlobLeaseClient(leaseId);

async function runLeaseCommand(command: "renew" | "release"): Promise<void> {
  if (command === "renew") {
    await leaseClient.renewLease();
  } else {
    await leaseClient.releaseLease();
  }
}

function send(message: object): void {
  if (process.connected) {
    process.send?.(message);
  }
}

function fail(error: unknown): void {
  stopped = true;
  const message = error instanceof Error ? error.message : String(error);
  send({ type: "failed", message });
}

function enqueue(command: "renew" | "release", requestId?: number): void {
  operation = operation.then(async () => {
    if (stopped && command !== "release") {
      return;
    }
    await runLeaseCommand(command);
    send({ type: command === "renew" ? "renewed" : "released", requestId, at: Date.now() });
    if (command === "release") {
      stopped = true;
      clearInterval(interval);
    }
  }).catch(fail);
}

const interval = setInterval(() => {
  if (!stopped) {
    enqueue("renew");
  }
}, RENEWAL_INTERVAL_MS);

process.on("message", (message: { type?: string; requestId?: number }) => {
  if (message.type === "renew") {
    enqueue("renew", message.requestId);
  } else if (message.type === "release") {
    clearInterval(interval);
    enqueue("release", message.requestId);
  } else if (message.type === "stop") {
    stopped = true;
    clearInterval(interval);
    process.disconnect?.();
  }
});

process.on("disconnect", () => {
  stopped = true;
  clearInterval(interval);
  process.exit(0);
});
