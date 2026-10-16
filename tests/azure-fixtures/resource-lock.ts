import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LEASE_DURATION_SECONDS = 60;
const ACKNOWLEDGEMENT_TIMEOUT_MS = 30_000;
const __dirname = dirname(fileURLToPath(import.meta.url));

export interface IBlobLeaseClient {
  acquireLease(duration: number): Promise<unknown>;
};

export interface IBlockBlobClient {
  readonly name: string;
  upload(content: string, length: number, options?: {
    conditions?: { ifNoneMatch?: string; leaseId?: string };
  }): Promise<unknown>;
  downloadToBuffer(): Promise<Buffer>;
  getBlobLeaseClient(leaseId: string): IBlobLeaseClient;
};

export interface ILeaseRenewer {
  assertHealthy(): void;
  renew(): Promise<void>;
  release(): Promise<void>;
  stop(): void;
};

export interface ILeaseRenewerChildProcess {
  readonly connected: boolean;
  on(event: "message", listener: (message: LeaseMessage) => void): unknown;
  on(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  send(message: unknown, callback?: (error: Error | null) => void): boolean;
  kill(signal: NodeJS.Signals): boolean;
};

export interface IResourceLockDependencies {
  createBlobClient(accountName: string, containerName: string, blobName: string): IBlockBlobClient;
  createLeaseRenewer(accountName: string, containerName: string, blobName: string, leaseId: string): ILeaseRenewer;
  now(): number;
  sleep(ms: number): Promise<void>;
  jitter(delayMs: number): number;
  randomUUID(): string;
  initialRetryDelayMs: number;
  maximumRetryDelayMs: number;
  leaseDurationSeconds: number;
};

export type LeaseMessage = {
  type: "renewed" | "released" | "failed";
  requestId?: number;
  message?: string;
};

export class ChildProcessLeaseRenewer implements ILeaseRenewer {
  private failure: Error | undefined;
  private exited = false;
  private terminationRequested = false;
  private requestId = 0;
  private readonly pending = new Map<number, {
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  constructor(private readonly child: ILeaseRenewerChildProcess) {
    child.on("message", (message: LeaseMessage) => {
      if (message.type === "failed") {
        this.fail(new Error(`Resource lock lease renewal failed: ${message.message ?? "unknown error"}`));
        return;
      }
      if (message.requestId !== undefined) {
        const pending = this.pending.get(message.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pending.delete(message.requestId);
          pending.resolve();
        }
      }
    });
    child.on("exit", (code, signal) => {
      this.exited = true;
      this.fail(new Error(`Resource lock lease renewer exited unexpectedly (${signal ?? code})`));
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
    if (this.failure) {
      this.terminate();
      return;
    }
    if (!this.exited && this.child.connected) {
      this.child.send({ type: "stop" });
    }
  }

  private fail(error: Error): void {
    this.failure ??= error;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(this.failure);
    }
    this.pending.clear();
  }

  private terminate(): void {
    if (!this.exited && !this.terminationRequested) {
      this.terminationRequested = true;
      this.child.kill("SIGKILL");
    }
  }

  private request(type: "renew" | "release"): Promise<void> {
    this.assertHealthy();
    const requestId = ++this.requestId;
    return new Promise((resolvePromise, reject) => {
      const timeout = setTimeout(() => {
        this.fail(new Error(`Resource lock lease ${type} acknowledgement timed out after ${ACKNOWLEDGEMENT_TIMEOUT_MS}ms`));
        this.terminate();
      }, ACKNOWLEDGEMENT_TIMEOUT_MS);
      this.pending.set(requestId, { resolve: resolvePromise, reject, timeout });
      try {
        this.child.send({ type, requestId }, (error) => {
          if (error) {
            this.fail(error);
          }
        });
      } catch (error) {
        this.fail(error instanceof Error ? error : new Error(String(error)));
      }
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
): ChildProcessLeaseRenewer {
  const scriptPath = resolve(__dirname, "renew-fixture-lease.ts");
  const child = spawn(process.execPath, ["--import", "tsx", scriptPath, accountName, containerName, blobName, leaseId], {
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  return new ChildProcessLeaseRenewer(child);
}

export class ResourceLock {
  private readonly blobClient: IBlockBlobClient;
  private readonly dependencies: IResourceLockDependencies;

  constructor(
    private readonly accountName: string,
    private readonly containerName: string,
    private readonly blobName: string,
    private readonly acquisitionDeadline: number,
    dependencies: Partial<IResourceLockDependencies> = {},
  ) {
    this.dependencies = {
      createBlobClient: (account, container, blob) => {
        const serviceClient = new BlobServiceClient(
          `https://${account}.blob.core.windows.net`,
          new DefaultAzureCredential(),
        );
        return serviceClient.getContainerClient(container).getBlockBlobClient(blob);
      },
      createLeaseRenewer: startLeaseRenewer,
      now: Date.now,
      sleep: (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms)),
      jitter: (delayMs) => Math.floor(Math.random() * delayMs),
      randomUUID,
      initialRetryDelayMs: 500,
      maximumRetryDelayMs: 10_000,
      leaseDurationSeconds: LEASE_DURATION_SECONDS,
      ...dependencies,
    };
    this.blobClient = this.dependencies.createBlobClient(accountName, containerName, blobName);
  }

  async initialize(initialValue: unknown): Promise<void> {
    const content = JSON.stringify(initialValue);
    try {
      await this.blobClient.upload(content, Buffer.byteLength(content), {
        conditions: { ifNoneMatch: "*" },
      });
    } catch (error) {
      if (!["BlobAlreadyExists", "ConditionNotMet", "LeaseIdMissing"].includes(storageErrorCode(error) ?? "")) {
        throw error;
      }
    }
  }

  async acquire(): Promise<ResourceLockLease> {
    let delayMs = this.dependencies.initialRetryDelayMs;
    while (this.dependencies.now() < this.acquisitionDeadline) {
      try {
        const leaseId = this.dependencies.randomUUID();
        await this.blobClient.getBlobLeaseClient(leaseId).acquireLease(this.dependencies.leaseDurationSeconds);
        return new ResourceLockLease(
          this.blobClient,
          leaseId,
          this.dependencies.createLeaseRenewer(this.accountName, this.containerName, this.blobName, leaseId),
        );
      } catch (error) {
        if (!isLeaseContention(error)) {
          throw error;
        }
        const waitMs = Math.min(
          delayMs + this.dependencies.jitter(delayMs),
          this.acquisitionDeadline - this.dependencies.now(),
        );
        if (waitMs > 0) {
          await this.dependencies.sleep(waitMs);
        }
        delayMs = Math.min(delayMs * 2, this.dependencies.maximumRetryDelayMs);
      }
    }
    throw new Error(`Timed out acquiring resource lock for ${this.blobClient.name}`);
  }
}

export class ResourceLockLease {
  private releasePromise: Promise<void> | undefined;
  private operation = Promise.resolve();

  constructor(
    private readonly blobClient: IBlockBlobClient,
    private readonly leaseId: string,
    private readonly renewer: ILeaseRenewer,
  ) { }

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
    return this.serialize(() => this.renewer.renew());
  }

  release(): Promise<void> {
    if (!this.releasePromise) {
      this.releasePromise = this.serialize(async () => {
        try {
          await this.renewer.release();
        } finally {
          this.renewer.stop();
        }
      });
    }
    return this.releasePromise;
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operation.then(operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }
}
