import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import {
  ChildProcessLeaseRenewer,
  ResourceLock,
  ResourceLockLease,
  type IBlockBlobClient,
  type LeaseMessage,
  type ILeaseRenewerChildProcess,
  type ILeaseRenewer,
  type IResourceLockDependencies,
} from "../resource-lock.ts";

function storageError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

class FakeRenewer implements ILeaseRenewer {
  healthy = true;
  renewCount = 0;
  releaseCount = 0;
  stopCount = 0;
  operations: string[] = [];

  assertHealthy(): void {
    if (!this.healthy) {
      throw new Error("renewer unhealthy");
    }
  }

  async renew(): Promise<void> {
    this.assertHealthy();
    this.operations.push("renew");
    this.renewCount++;
  }

  async release(): Promise<void> {
    this.assertHealthy();
    this.operations.push("release");
    this.releaseCount++;
  }

  stop(): void {
    this.operations.push("stop");
    this.stopCount++;
  }
}

class FakeBlob implements IBlockBlobClient {
  readonly name = "coordination.json";
  content = Buffer.from("");
  uploads: { content: string; leaseId?: string; ifNoneMatch?: string }[] = [];
  acquireErrors: Error[] = [];
  acquiredLeaseIds: string[] = [];

  async upload(
    content: string,
    _length: number,
    options?: { conditions?: { ifNoneMatch?: string; leaseId?: string } },
  ): Promise<void> {
    this.uploads.push({
      content,
      leaseId: options?.conditions?.leaseId,
      ifNoneMatch: options?.conditions?.ifNoneMatch,
    });
    this.content = Buffer.from(content);
  }

  async downloadToBuffer(): Promise<Buffer> {
    return Buffer.from(this.content);
  }

  getBlobLeaseClient(leaseId: string): { acquireLease(duration: number): Promise<void> } {
    return {
      acquireLease: async () => {
        const error = this.acquireErrors.shift();
        if (error) {
          throw error;
        }
        this.acquiredLeaseIds.push(leaseId);
      },
    };
  }
}

function createLock(
  blob: FakeBlob,
  renewer: FakeRenewer,
  overrides: Partial<IResourceLockDependencies> = {},
): { lock: ResourceLock; sleeps: number[]; setNow(value: number): void } {
  let now = 0;
  const sleeps: number[] = [];
  const lock = new ResourceLock("account", "container", "blob", {
    createBlobClient: () => blob,
    createLeaseRenewer: () => renewer,
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
    jitter: () => 0,
    randomUUID: () => "lease-id",
    initialRetryDelayMs: 10,
    maximumRetryDelayMs: 40,
    leaseDurationSeconds: 60,
    ...overrides,
  });
  return { lock, sleeps, setNow: (value) => { now = value; } };
}

describe("ResourceLock", () => {
  it.each(["BlobAlreadyExists", "ConditionNotMet"])(
    "initializes once and tolerates %s",
    async (code) => {
      const blob = new FakeBlob();
      blob.upload = vi.fn().mockRejectedValue(storageError(code));
      const { lock } = createLock(blob, new FakeRenewer());

      await expect(lock.initialize({ state: "Empty" })).resolves.toBeUndefined();
      expect(blob.upload).toHaveBeenCalledWith(
        '{"state":"Empty"}',
        17,
        { conditions: { ifNoneMatch: "*" } },
      );
    },
  );

  it("fails initialization on unexpected storage errors", async () => {
    const blob = new FakeBlob();
    blob.upload = vi.fn().mockRejectedValue(storageError("AuthorizationFailure"));
    const { lock } = createLock(blob, new FakeRenewer());

    await expect(lock.initialize({ state: "Empty" })).rejects.toThrow("AuthorizationFailure");
  });

  it("acquires immediately and starts one renewer for the acquired lease", async () => {
    const blob = new FakeBlob();
    const renewer = new FakeRenewer();
    const factory = vi.fn(() => renewer);
    const { lock } = createLock(blob, renewer, { createLeaseRenewer: factory });

    await expect(lock.acquire(100)).resolves.toBeInstanceOf(ResourceLockLease);
    expect(blob.acquiredLeaseIds).toEqual(["lease-id"]);
    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith("account", "container", "blob", "lease-id");
  });

  it("retries only contention errors with capped backoff and deterministic jitter", async () => {
    const blob = new FakeBlob();
    blob.acquireErrors.push(
      storageError("LeaseAlreadyPresent"),
      storageError("LeaseIsBreakingAndCannotBeAcquired"),
      storageError("LeaseAlreadyPresent"),
    );
    const { lock, sleeps } = createLock(blob, new FakeRenewer(), { jitter: (delay) => delay / 2 });

    await lock.acquire(200);

    expect(sleeps).toEqual([15, 30, 60]);
  });

  it("rejects at the acquisition deadline without creating a renewer", async () => {
    const blob = new FakeBlob();
    blob.acquireErrors.push(
      storageError("LeaseAlreadyPresent"),
      storageError("LeaseAlreadyPresent"),
      storageError("LeaseAlreadyPresent"),
    );
    const factory = vi.fn(() => new FakeRenewer());
    const { lock } = createLock(blob, new FakeRenewer(), { createLeaseRenewer: factory });

    await expect(lock.acquire(25)).rejects.toThrow("Timed out acquiring resource lock");
    expect(factory).not.toHaveBeenCalled();
  });

  it("fails acquisition immediately on non-contention errors", async () => {
    const blob = new FakeBlob();
    blob.acquireErrors.push(storageError("AuthorizationFailure"));
    const { lock, sleeps } = createLock(blob, new FakeRenewer());

    await expect(lock.acquire(100)).rejects.toThrow("AuthorizationFailure");
    expect(sleeps).toEqual([]);
  });
});

describe("ResourceLockLease", () => {
  it("checks health for reads and writes and writes with the active lease ID", async () => {
    const blob = new FakeBlob();
    blob.content = Buffer.from('{"state":"Ready"}');
    const renewer = new FakeRenewer();
    const lease = new ResourceLockLease(blob, "lease-1", renewer);

    await expect(lease.read()).resolves.toEqual({ state: "Ready" });
    await lease.write({ state: "Preparing" });
    expect(blob.uploads.at(-1)).toMatchObject({ leaseId: "lease-1" });

    renewer.healthy = false;
    await expect(lease.read()).rejects.toThrow("renewer unhealthy");
    await expect(lease.write({ state: "Ready" })).rejects.toThrow("renewer unhealthy");
  });

  it("waits for explicit renewal acknowledgement", async () => {
    const blob = new FakeBlob();
    let acknowledge: () => void = () => { };
    const renewer = new FakeRenewer();
    renewer.renew = vi.fn(() => new Promise<void>((resolve) => { acknowledge = resolve; }));
    const lease = new ResourceLockLease(blob, "lease-1", renewer);
    let settled = false;

    const renewal = lease.renew().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    acknowledge();
    await renewal;
    expect(settled).toBe(true);
  });

  it("serializes release after renewal and makes release idempotent", async () => {
    const blob = new FakeBlob();
    let acknowledge: () => void = () => { };
    const renewer = new FakeRenewer();
    renewer.renew = vi.fn(async () => {
      renewer.operations.push("renew-start");
      await new Promise<void>((resolve) => { acknowledge = resolve; });
      renewer.operations.push("renew-end");
    });
    const lease = new ResourceLockLease(blob, "lease-1", renewer);

    const renewal = lease.renew();
    const firstRelease = lease.release();
    const secondRelease = lease.release();
    await Promise.resolve();
    expect(renewer.releaseCount).toBe(0);
    acknowledge();
    await Promise.all([renewal, firstRelease, secondRelease]);

    expect(renewer.operations).toEqual(["renew-start", "renew-end", "release", "stop"]);
    expect(renewer.releaseCount).toBe(1);
    expect(renewer.stopCount).toBe(1);
  });

  it("rejects stale lease writes without changing the blob or the new owner's data", async () => {
    class LeasedBlob extends FakeBlob {
      currentLease = "lease-1";

      override async upload(
        content: string,
        length: number,
        options?: { conditions?: { ifNoneMatch?: string; leaseId?: string } },
      ): Promise<void> {
        if (options?.conditions?.leaseId !== this.currentLease) {
          throw storageError("LeaseIdMismatchWithBlobOperation");
        }
        await super.upload(content, length, options);
      }
    }
    const blob = new LeasedBlob();
    const stale = new ResourceLockLease(blob, "lease-1", new FakeRenewer());
    const current = new ResourceLockLease(blob, "lease-2", new FakeRenewer());

    await stale.write({ owner: "old" });
    blob.currentLease = "lease-2";
    await expect(stale.write({ owner: "stale" })).rejects.toThrow("LeaseIdMismatchWithBlobOperation");
    expect(blob.content.toString()).toContain("old");
    await current.write({ owner: "new" });
    await expect(stale.write({ owner: "stale-again" })).rejects.toThrow("LeaseIdMismatchWithBlobOperation");
    expect(blob.content.toString()).toContain("new");
  });

  it("blocks renew and release once the renewer is unhealthy, and still stops it", async () => {
    const renewer = new FakeRenewer();
    renewer.healthy = false;
    const lease = new ResourceLockLease(new FakeBlob(), "lease-1", renewer);

    await expect(lease.renew()).rejects.toThrow("renewer unhealthy");
    await expect(lease.release()).rejects.toThrow("renewer unhealthy");
    expect(renewer.stopCount).toBe(1);
    await expect(lease.release()).rejects.toThrow("renewer unhealthy");
    expect(renewer.stopCount).toBe(1);
  });

  it("keeps serving later operations after a failed renewal", async () => {
    const renewer = new FakeRenewer();
    renewer.renew = vi.fn().mockRejectedValueOnce(new Error("renew failed"));
    const lease = new ResourceLockLease(new FakeBlob(), "lease-1", renewer);

    await expect(lease.renew()).rejects.toThrow("renew failed");
    await expect(lease.release()).resolves.toBeUndefined();
    expect(renewer.releaseCount).toBe(1);
  });

  it("always stops the renewer when release fails", async () => {
    const renewer = new FakeRenewer();
    renewer.release = vi.fn().mockRejectedValue(new Error("release failed"));
    const lease = new ResourceLockLease(new FakeBlob(), "lease-1", renewer);

    await expect(lease.release()).rejects.toThrow("release failed");
    expect(renewer.stopCount).toBe(1);
  });
});

class FakeChild extends EventEmitter implements ILeaseRenewerChildProcess {
  connected = true;
  sent: unknown[] = [];

  send(message: unknown, callback?: (error: Error | null) => void): boolean {
    this.sent.push(message);
    callback?.(null);
    return true;
  }

  message(message: LeaseMessage): void {
    this.emit("message", message);
  }

  exit(code: number | null, signal: NodeJS.Signals | null = null): void {
    this.connected = false;
    this.emit("exit", code, signal);
  }
}

describe("ChildProcessLeaseRenewer", () => {
  it("resolves acknowledged requests and sends stop", async () => {
    const child = new FakeChild();
    const renewer = new ChildProcessLeaseRenewer(child);

    const renewal = renewer.renew();
    child.message({ type: "renewed", requestId: 1 });
    await renewal;
    renewer.stop();

    expect(child.sent).toEqual([
      { type: "renew", requestId: 1 },
      { type: "stop" },
    ]);
  });

  it.each([
    ["failure message", (child: FakeChild) => child.message({ type: "failed", message: "boom" })],
    ["unexpected exit", (child: FakeChild) => child.exit(0)],
  ])("rejects pending and future requests after %s", async (_name, fail) => {
    const child = new FakeChild();
    const renewer = new ChildProcessLeaseRenewer(child);
    const pending = renewer.renew();

    fail(child);

    await expect(pending).rejects.toThrow();
    await expect(Promise.resolve().then(() => renewer.renew())).rejects.toThrow();
  });

  it("resolves release acknowledgements and correlates them by request ID", async () => {
    const child = new FakeChild();
    const renewer = new ChildProcessLeaseRenewer(child);
    const first = renewer.renew();
    const second = renewer.release();
    let secondSettled = false;
    void second.then(() => { secondSettled = true; });

    child.message({ type: "released", requestId: 2 });
    await second;
    expect(secondSettled).toBe(true);
    child.message({ type: "renewed", requestId: 1 });
    await first;
    expect(child.sent).toEqual([{ type: "renew", requestId: 1 }, { type: "release", requestId: 2 }]);
  });

  it("ignores acknowledgements for unknown requests", () => {
    const child = new FakeChild();
    const renewer = new ChildProcessLeaseRenewer(child);

    child.message({ type: "renewed", requestId: 99 });
    child.message({ type: "renewed" });
    expect(() => renewer.assertHealthy()).not.toThrow();
  });

  it("rejects a request whose IPC send fails", async () => {
    const child = new FakeChild();
    child.send = (_message, callback) => {
      callback?.(new Error("channel closed"));
      return false;
    };
    const renewer = new ChildProcessLeaseRenewer(child);

    await expect(renewer.renew()).rejects.toThrow("channel closed");
  });

  it("reports the renewer failure through assertHealthy and keeps the first failure", () => {
    const child = new FakeChild();
    const renewer = new ChildProcessLeaseRenewer(child);

    child.message({ type: "failed", message: "boom" });
    child.exit(1);
    expect(() => renewer.assertHealthy()).toThrow("boom");
  });

  it("reports an unexpected exit through assertHealthy", () => {
    const child = new FakeChild();
    const renewer = new ChildProcessLeaseRenewer(child);

    child.exit(null, "SIGKILL");
    expect(() => renewer.assertHealthy()).toThrow("SIGKILL");
  });

  it("sends stop only while the child is alive and connected", () => {
    const alive = new FakeChild();
    new ChildProcessLeaseRenewer(alive).stop();
    expect(alive.sent).toEqual([{ type: "stop" }]);

    const exited = new FakeChild();
    const exitedRenewer = new ChildProcessLeaseRenewer(exited);
    exited.exit(0);
    exitedRenewer.stop();
    expect(exited.sent).toEqual([]);

    const disconnected = new FakeChild();
    disconnected.connected = false;
    new ChildProcessLeaseRenewer(disconnected).stop();
    expect(disconnected.sent).toEqual([]);
  });
});
