import type {
  FixtureRunContext,
  WorkflowProvisioningDependencies,
  WorkflowResourceLockLease,
} from "../../provision-fixture.ts";
import { createBudget, type WorkflowFixtureManifest } from "../../fixture-common.ts";

type Group = {
  name: string;
  location: string;
  tags: Record<string, string>;
};

export type JournalEntry = {
  actor: string;
  operation: string;
  args?: string[];
  value?: unknown;
  options?: { subjectToBudget?: boolean };
};

type FailureRule = {
  actor?: string;
  operation: string;
  invocation?: number;
  error: Error;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function option(args: string[], name: string): string {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) {
    throw new Error(`Missing ${name} in az ${args.join(" ")}`);
  }
  return args[index + 1];
}

function parseTags(args: string[]): Record<string, string> {
  const start = args.indexOf("--tags");
  if (start < 0) {
    return {};
  }
  const end = args.indexOf("-o", start);
  const tags: Record<string, string> = {};
  for (const raw of args.slice(start + 1, end < 0 ? undefined : end)) {
    const tag = raw.replace(/^"|"$/g, "");
    const separator = tag.indexOf("=");
    const key = tag.slice(0, separator);
    if (key in tags) {
      throw new Error(`Duplicate tag ${key} in az ${args.join(" ")}`);
    }
    if (key.includes("\"")) {
      throw new Error(`Tag key ${key} contains a quote character`);
    }
    tags[key] = tag.slice(separator + 1);
  }
  return tags;
}

type Hook = {
  actor?: string;
  operation: string;
  invocation?: number;
  run(): void;
};

export class FakeAzureEnvironment {
  readonly groups = new Map<string, Group>();
  readonly journal: JournalEntry[] = [];
  readonly logs: { level: "log" | "warn" | "error"; actor: string; message: string }[] = [];
  readonly postProvisionRuns: { actor: string; groups: string[] }[] = [];
  readonly failures: FailureRule[] = [];
  readonly hooks: Hook[] = [];
  coordination: unknown = undefined;
  coordinationWrites = 0;
  activeLeaseId: string | undefined;
  maximumActiveLeases = 0;
  deploymentCount = 0;
  staleWriteRejections = 0;
  nowMs = Date.parse("2026-01-01T00:00:00Z");
  readonly budget = createBudget(() => this.nowMs);
  account = {
    id: "subscription-1",
    tenantId: "tenant-1",
    user: { name: "principal-app", type: "servicePrincipal" },
  };
  principalId = "principal-object-1";
  private leaseSequence = 0;
  private activeLeaseCount = 0;
  private waiters: (() => void)[] = [];
  private invocationCounts = new Map<string, number>();
  private deploymentBarrier: Promise<void> | undefined;

  holdDeployments(): () => void {
    let release: () => void = () => {};
    this.deploymentBarrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    return () => {
      this.deploymentBarrier = undefined;
      release();
    };
  }

  /** Runs a callback just before the matching operation executes. */
  onOperation(hook: Hook): void {
    this.hooks.push(hook);
  }

  /** Simulates lease expiry: the current holder becomes stale and others may acquire. */
  expireLease(): void {
    if (this.activeLeaseId) {
      this.activeLeaseId = undefined;
      this.activeLeaseCount--;
      this.journal.push({ actor: "environment", operation: "lease-expired" });
      this.wakeWaiters();
    }
  }

  fail(rule: FailureRule): void {
    this.failures.push(rule);
  }

  advance(ms: number): void {
    this.nowMs += ms;
    this.wakeWaiters();
  }

  createDependencies(actor: string, environment: NodeJS.ProcessEnv = {}): WorkflowProvisioningDependencies {
    let uuidIndex = 0;
    return {
      now: () => this.nowMs,
      sleep: async (ms) => {
        this.advance(ms);
        await Promise.resolve();
      },
      immediate: async () => Promise.resolve(),
      randomUUID: () => `${actor}-uuid-${++uuidIndex}`,
      randomSuffix: () => `${actor.replaceAll(/[^a-z0-9]/gi, "").slice(0, 6)}${uuidIndex}`,
      runAz: (args, options) => this.runAz(actor, args, options),
      runPostProvisionScript: (context) => this.runPostProvision(actor, context),
      createResourceLock: () => ({
        initialize: async (initialValue) => {
          this.throwIfFailed(actor, "initialize");
          if (this.coordination === undefined) {
            this.coordination = clone(initialValue);
            this.journal.push({ actor, operation: "initialize", value: clone(initialValue) });
          }
        },
        acquire: (deadline) => this.acquire(actor, deadline),
      }),
      budget: this.budget,
      log: {
        log: (...values) => this.recordLog(actor, "log", values),
        warn: (...values) => this.recordLog(actor, "warn", values),
        error: (...values) => this.recordLog(actor, "error", values),
      },
      environment: {
        AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT: "storage",
        AZURE_FIXTURE_COORDINATION_CONTAINER: "fixtures",
        ...environment,
      },
      processId: 1234,
      leaseAcquisitionBudgetMs: 10_000,
      totalBudgetMs: 5_000,
      provisioningRetryDelayMs: 200,
      readyRetentionMs: 60_000,
    };
  }

  expectConsistent(): void {
    if (this.activeLeaseId !== undefined || this.activeLeaseCount !== 0) {
      throw new Error(`Leaked active lease ${this.activeLeaseId ?? "(count only)"}`);
    }
    if (this.maximumActiveLeases > 1) {
      throw new Error(`Observed ${this.maximumActiveLeases} simultaneous leases`);
    }
  }

  seedCompleteInstance(manifest: WorkflowFixtureManifest, instanceId: string, suffix = instanceId): void {
    for (const config of manifest.bicepConfigs) {
      const name = `${config.resourceGroupNameBase}-${manifest.version}-${suffix}`;
      this.groups.set(name, {
        name,
        location: config.location,
        tags: {
          FixtureId: config.fixtureId,
          FixtureVersion: String(manifest.version),
          WorkflowFixtureId: manifest.id,
          FixtureInstanceId: instanceId,
          FixtureComponent: config.resourceGroupNameBase,
          Completed: "True",
          DeleteAfter: "01/01/2026 00:00:00",
        },
      });
    }
  }

  private async acquire(actor: string, deadline: number): Promise<WorkflowResourceLockLease> {
    this.throwIfFailed(actor, "acquire");
    while (this.activeLeaseId) {
      this.journal.push({ actor, operation: "acquire-contended" });
      if (this.nowMs >= deadline) {
        throw new Error("Timed out acquiring resource lock for coordination");
      }
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    if (this.nowMs >= deadline) {
      throw new Error("Timed out acquiring resource lock for coordination");
    }
    const leaseId = `${actor}-lease-${++this.leaseSequence}`;
    this.activeLeaseId = leaseId;
    this.activeLeaseCount++;
    this.maximumActiveLeases = Math.max(this.maximumActiveLeases, this.activeLeaseCount);
    this.journal.push({ actor, operation: "acquire", value: leaseId });
    let released = false;
    let healthy = true;
    const assertOwner = () => {
      if (!healthy) {
        throw new Error(`Lease renewer failed for ${actor}`);
      }
      if (this.activeLeaseId !== leaseId) {
        throw new Error(`Stale lease ${leaseId}`);
      }
    };
    return {
      assertHealthy: assertOwner,
      read: async () => {
        assertOwner();
        this.throwIfFailed(actor, "read");
        this.journal.push({ actor, operation: "read" });
        return clone(this.coordination);
      },
      write: async (value) => {
        this.throwIfFailed(actor, "write");
        try {
          assertOwner();
        } catch (error) {
          this.staleWriteRejections++;
          throw error;
        }
        this.coordination = clone(value);
        this.coordinationWrites++;
        this.journal.push({ actor, operation: "write", value: clone(value) });
      },
      renew: async () => {
        assertOwner();
        this.throwIfFailed(actor, "renew");
        this.journal.push({ actor, operation: "renew" });
      },
      release: async () => {
        if (released) {
          return;
        }
        let failure: unknown;
        try {
          this.throwIfFailed(actor, "release");
        } catch (error) {
          failure = error;
        }
        released = true;
        healthy = false;
        if (this.activeLeaseId === leaseId) {
          this.activeLeaseId = undefined;
          this.activeLeaseCount--;
        }
        this.journal.push({ actor, operation: "release", value: leaseId });
        this.wakeWaiters();
        if (failure) {
          throw failure;
        }
      },
    };
  }

  private runAz(actor: string, args: string[], options?: { subjectToBudget?: boolean }): string {
    const operation = args.slice(0, 3).join(" ");
    this.throwIfFailed(actor, operation);
    if (options?.subjectToBudget !== false) {
      this.budget.remainingMs(`az ${args.join(" ")}`);
    }
    this.journal.push({ actor, operation: "az", args: [...args], options });

    if (args.join(" ") === "account show -o json") {
      return JSON.stringify(this.account);
    }
    if (args[0] === "ad" && args[1] === "sp" && args[2] === "show") {
      return this.principalId;
    }
    if (args[0] === "ad" && args[1] === "signed-in-user" && args[2] === "show") {
      return this.principalId;
    }
    if (args[0] === "group" && args[1] === "list") {
      const [tagName, tagValue] = option(args, "--tag").split("=", 2);
      return JSON.stringify([...this.groups.values()]
        .filter((group) => group.tags[tagName] === tagValue)
        .map(({ name, tags }) => ({ name, tags })));
    }
    if (args[0] === "group" && args[1] === "exists") {
      return String(this.groups.has(option(args, "--name")));
    }
    if (args[0] === "group" && args[1] === "show") {
      const group = this.requiredGroup(option(args, "--name"));
      const query = option(args, "--query");
      if (query === "tags") {
        return JSON.stringify(group.tags);
      }
      if (query.startsWith("tags.")) {
        return group.tags[query.slice("tags.".length)] ?? "";
      }
    }
    if (args[0] === "group" && args[1] === "create") {
      const name = option(args, "--name");
      this.groups.set(name, {
        name,
        location: option(args, "--location"),
        tags: parseTags(args),
      });
      return "";
    }
    if (args[0] === "group" && args[1] === "update") {
      const group = this.requiredGroup(option(args, "--name"));
      const assignment = option(args, "--set").replace(/^"|"$/g, "");
      const separator = assignment.indexOf("=");
      group.tags[assignment.slice("tags.".length, separator)] = assignment.slice(separator + 1);
      return "";
    }
    if (args[0] === "deployment" && args[1] === "group" && args[2] === "create") {
      this.deploymentCount++;
      if (this.deploymentBarrier) {
        throw new Error("Synchronous fake CLI cannot pause; use immediate barrier instead");
      }
      return "";
    }
    throw new Error(`Unexpected az command: az ${args.join(" ")}`);
  }

  private runPostProvision(actor: string, context: FixtureRunContext): string | undefined {
    this.throwIfFailed(actor, "post-provision");
    this.budget.remainingMs("post-provision script");
    this.postProvisionRuns.push({ actor, groups: Object.values(context.resourceGroupNames) });
    this.journal.push({ actor, operation: "post-provision" });
    return undefined;
  }

  private requiredGroup(name: string): Group {
    const group = this.groups.get(name);
    if (!group) {
      throw new Error(`Resource group ${name} does not exist`);
    }
    return group;
  }

  private throwIfFailed(actor: string, operation: string): void {
    const key = `${actor}:${operation}`;
    const invocation = (this.invocationCounts.get(key) ?? 0) + 1;
    this.invocationCounts.set(key, invocation);
    for (const hook of this.hooks) {
      if (hook.operation === operation
        && (hook.actor === undefined || hook.actor === actor)
        && (hook.invocation === undefined || hook.invocation === invocation)) {
        hook.run();
      }
    }
    const rule = this.failures.find((candidate) =>
      candidate.operation === operation
      && (candidate.actor === undefined || candidate.actor === actor)
      && (candidate.invocation === undefined || candidate.invocation === invocation));
    if (rule) {
      throw rule.error;
    }
  }

  private recordLog(actor: string, level: "log" | "warn" | "error", values: unknown[]): void {
    this.logs.push({ actor, level, message: values.map(String).join(" ") });
  }

  private wakeWaiters(): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }
}
