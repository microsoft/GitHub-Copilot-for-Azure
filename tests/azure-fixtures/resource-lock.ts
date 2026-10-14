import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient, type BlockBlobClient } from "@azure/storage-blob";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const NPX_COMMAND = process.platform === "win32" ? "npx.cmd" : "npx";
const LEASE_DURATION_SECONDS = 60;

type LeaseMessage = {
  type: "renewed" | "released" | "failed";
  requestId?: number;
  message?: string;
};

class LeaseRenewer {
  private failure: Error | undefined;
  private exited = false;
  private requestId = 0;
  private readonly pending = new Map<number, {
    resolve: () => void;
    reject: (error: Error) => void;
  }>();

  constructor(private readonly child: ChildProcess) {
    child.on("message", (message: LeaseMessage) => {
      if (message.type === "failed") {
        this.failure = new Error(`Resource lock lease renewal failed: ${message.message ?? "unknown error"}`);
        for (const pending of this.pending.values()) {
          pending.reject(this.failure);
        }
        this.pending.clear();
        return;
      }
      if (message.requestId !== undefined) {
        const pending = this.pending.get(message.requestId);
        if (pending) {
          this.pending.delete(message.requestId);
          pending.resolve();
        }
      }
    });
    child.on("exit", (code, signal) => {
      this.exited = true;
      if (!this.failure && code !== 0) {
        this.failure = new Error(`Resource lock lease renewer exited unexpectedly (${signal ?? code})`);
      }
      if (this.failure) {
        for (const pending of this.pending.values()) {
          pending.reject(this.failure);
        }
        this.pending.clear();
      }
    });
  }

  assertHealthy(): void {
    if (this.failure) {
      throw this.failure;
    }
    if (this.exited) {
      throw new Error("Resource lock lease renewer exited unexpectedly");
    }
  }

  renew(): Promise<void> {
    return this.request("renew");
  }

  release(): Promise<void> {
    return this.request("release");
  }

  stop(): void {
    if (!this.exited && this.child.connected) {
      this.child.send({ type: "stop" });
    }
  }

  private request(type: "renew" | "release"): Promise<void> {
    this.assertHealthy();
    const requestId = ++this.requestId;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(requestId, { resolve: resolvePromise, reject });
      this.child.send({ type, requestId }, (error) => {
        if (error) {
          this.pending.delete(requestId);
          reject(error);
        }
      });
    });
  }
}

function storageErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const candidate = error as { code?: string; details?: { errorCode?: string } };
  return candidate.details?.errorCode ?? candidate.code;
}

function isLeaseContention(error: unknown): boolean {
  return ["LeaseAlreadyPresent", "LeaseIsBreakingAndCannotBeAcquired"].includes(storageErrorCode(error) ?? "");
}

function startLeaseRenewer(
  accountName: string,
  containerName: string,
  blobName: string,
  leaseId: string,
): LeaseRenewer {
  const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), "renew-fixture-lease.ts");
  const child = spawn(NPX_COMMAND, ["-y", "tsx", scriptPath, accountName, containerName, blobName, leaseId], {
    stdio: ["ignore", "inherit", "inherit", "ipc"],
    shell: process.platform === "win32",
  });
  return new LeaseRenewer(child);
}

export class ResourceLock {
  private readonly blobClient: BlockBlobClient;

  constructor(
    private readonly accountName: string,
    private readonly containerName: string,
    private readonly blobName: string,
  ) {
    const serviceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      new DefaultAzureCredential(),
    );
    this.blobClient = serviceClient.getContainerClient(containerName).getBlockBlobClient(blobName);
  }

  async initialize(initialValue: unknown): Promise<void> {
    const content = JSON.stringify(initialValue);
    try {
      await this.blobClient.upload(content, Buffer.byteLength(content), {
        conditions: { ifNoneMatch: "*" },
      });
    } catch (error) {
      if (!["BlobAlreadyExists", "ConditionNotMet"].includes(storageErrorCode(error) ?? "")) {
        throw error;
      }
    }
  }

  async acquire(deadline: number): Promise<ResourceLockLease> {
    let delayMs = 500;
    while (Date.now() < deadline) {
      try {
        const leaseId = randomUUID();
        await this.blobClient.getBlobLeaseClient(leaseId).acquireLease(LEASE_DURATION_SECONDS);
        return new ResourceLockLease(
          this.blobClient,
          leaseId,
          startLeaseRenewer(this.accountName, this.containerName, this.blobName, leaseId),
        );
      } catch (error) {
        if (!isLeaseContention(error)) {
          throw error;
        }
        const waitMs = Math.min(delayMs + Math.floor(Math.random() * delayMs), deadline - Date.now());
        if (waitMs > 0) {
          await new Promise((resolvePromise) => setTimeout(resolvePromise, waitMs));
        }
        delayMs = Math.min(delayMs * 2, 10_000);
      }
    }
    throw new Error(`Timed out acquiring resource lock for ${this.blobClient.name}`);
  }
}

export class ResourceLockLease {
  private released = false;

  constructor(
    private readonly blobClient: BlockBlobClient,
    private readonly leaseId: string,
    private readonly renewer: LeaseRenewer,
  ) {}

  assertHealthy(): void {
    this.renewer.assertHealthy();
  }

  async read(): Promise<unknown> {
    this.assertHealthy();
    return JSON.parse((await this.blobClient.downloadToBuffer()).toString("utf8")) as unknown;
  }

  async write(value: unknown): Promise<void> {
    this.assertHealthy();
    const content = JSON.stringify(value, null, 2);
    await this.blobClient.upload(content, Buffer.byteLength(content), {
      conditions: { leaseId: this.leaseId },
    });
  }

  renew(): Promise<void> {
    return this.renewer.renew();
  }

  async release(): Promise<void> {
    if (this.released) {
      return;
    }
    try {
      await this.renewer.release();
      this.released = true;
    } finally {
      this.renewer.stop();
    }
  }
}
