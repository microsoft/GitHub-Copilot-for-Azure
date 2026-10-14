# Workflow-Scope Fixture Provisioning Local Test Plan

## Goal

Verify the workflow-scope fixture provisioning path locally without contacting Azure or starting real Azure CLI, Bicep, credential, storage, or lease-renewal processes.

The tests must exercise the same orchestration used by `provisionWorkflowManifest`, including:

- coordination blob initialization, lease acquisition, renewal, reads, conditional writes, and release;
- Azure account and principal discovery;
- resource-group discovery, creation, validation, tagging, expiration refresh, and deletion;
- Bicep deployment commands and post-provision scripts;
- concurrent workflow runs, abandoned attempts, retries, time budgets, and cleanup;
- the returned fixture identity and component-to-resource-group mapping.

Success is evaluated from observable state and operation history, not only from resolved or rejected promises.

## Test boundaries

### In scope

1. Unit tests for resource-lock behavior and the parent/renewer protocol.
2. Orchestration tests for `provisionWorkflowManifest`.
3. Deterministic concurrent calls sharing one in-memory Azure environment.
4. Fault injection at every Azure operation boundary.
5. Assertions over coordination records, leases, resource groups, deployments, command ordering, returned output, logs, and leaked work.

### Out of scope

- Azure service integration, Bicep correctness, RBAC propagation, and real deployment duration.
- Azure SDK or Azure CLI conformance beyond the response/error shapes consumed by this code.
- Performance benchmarking against Azure.
- End-to-end GitHub Actions wiring. Local tests model `GITHUB_RUN_ID` and `GITHUB_RUN_ATTEMPT` only as environment inputs.

## Required test seams

The current implementation directly constructs Azure SDK clients, starts a child process, invokes `az`, reads wall-clock time, generates random IDs, sleeps, and executes post-provision scripts. Introduce narrow dependencies while preserving production defaults:

```ts
type WorkflowProvisioningDependencies = {
  now(): number;
  sleep(ms: number): Promise<void>;
  immediate(): Promise<void>;
  randomUUID(): string;
  randomSuffix(): string;
  runAz(args: string[], options?: { subjectToBudget?: boolean }): string;
  runPostProvisionScript(...): string | undefined;
  createResourceLock(account: string, container: string, blob: string): ResourceLockLike;
  log: Pick<Console, "log" | "warn" | "error">;
};
```

Keep the public production entry point unchanged. Add an internal/test entry point that accepts dependencies, or move orchestration into a class constructed with these dependencies.

For `resource-lock.ts`, inject:

- a block-blob client or blob-client factory;
- a lease-renewer factory;
- clock, sleep, jitter, and UUID functions.

Represent the renewer behind a small interface with `assertHealthy`, `renew`, `release`, and `stop`. This lets orchestration tests avoid `spawn` while focused unit tests exercise the IPC adapter with a fake `ChildProcess`.

Do not mock private functions by module reloading or depend on Vitest import order. Prefer explicit dependency injection so concurrent test calls can use different workflow identities without sharing module-level mock state.

## In-memory mocked Azure environment

Create a reusable fake under `tests/azure-fixtures/__tests__/support/` with the following state.

### Coordination storage

For each blob:

- JSON content and an entity tag/version;
- current lease ID, acquisition time, duration, and expiry;
- lease owner history;
- queued waiters;
- an append-only history of initialize, acquire, renew, read, write, release, and rejected stale-owner operations.

Enforce the Azure behaviors used by production:

- `If-None-Match: *` creates once and otherwise returns `BlobAlreadyExists` or `ConditionNotMet`;
- only one unexpired lease can be acquired;
- competing acquisition returns `LeaseAlreadyPresent`;
- writes require the active lease ID;
- expired or stale lease IDs cannot write, renew, or release;
- advancing the virtual clock expires leases;
- reads return deep copies so tests cannot mutate stored records accidentally.

### Resource manager and CLI

Model subscriptions, tenants, principals, resource groups, tags, and deployments. Dispatch `runAz` by its exact argument vector and fail on every unrecognized command. Support:

- `account show`;
- `ad sp show` and `ad signed-in-user show`;
- `group list`, `group exists`, `group show`, `group create`, `group update`, and `group delete`;
- `deployment group create`.

Track every command with workflow actor, virtual timestamp, arguments, result, and injected failure. `group delete --no-wait` should record deletion scheduling separately from deletion completion.

`deployment group create` should be controllable by a deferred promise/barrier so a test can pause one workflow during deployment while other workflows contend for the lease.

### Deterministic time and scheduling

Use the local monotonic clock with test-specific, shortened lease, renewal, retry, and budget durations. Give every assertion sufficient margin around timing boundaries so normal event-loop and CI scheduling variation does not make tests flaky.

- Configure timing values through injected test settings rather than waiting for the production 15-second, 10-minute, or 30-minute intervals.
- Use deferred promises and barriers to hold operations at named milestones such as `lease-acquired`, `preparing-written`, `deployment-started`, `deployment-finished`, and `ready-written`.
- Trigger contention, renewal, expiration, and timeout conditions by holding a barrier longer than the configured test duration plus a generous safety margin.
- Assert ordering and eventual state instead of exact callback timestamps or millisecond-level elapsed times.
- UUIDs and suffixes come from per-actor queues, and jitter comes from a fixed sequence, so timing is the only intentionally real variable.

Keep individual timing tests short, but choose ratios that clearly separate expected events. For example, a 100 ms lease could renew every 25 ms, while expiration assertions wait at least 150 ms. Record observed timestamps for diagnostics when a timing assertion fails.

### Fault injection

Allow a failure rule to match operation type, actor, resource, and invocation number. Each rule should support:

- immediate typed Azure error;
- delayed success or failure;
- lease loss before or after the operation;
- child-renewer failure or unexpected exit;
- timeout/budget exhaustion;
- malformed JSON or malformed tags;
- process failure with `stderr`.

All tests should fail if an unexpected real `az`, `npx`, Azure credential, or network operation is attempted.

## Test suites

### 1. Resource lock unit tests

Add `tests/azure-fixtures/__tests__/resource-lock.test.ts`.

Cover:

1. Blob initialization creates `Empty` exactly once and tolerates only expected already-exists errors.
2. First contender acquires immediately and starts one renewer with the acquired lease ID.
3. Contenders retry only lease-contention errors with capped exponential backoff and deterministic jitter.
4. Acquisition deadline rejects without returning a lease or authorizing any write.
5. Non-contention storage errors fail immediately.
6. Read and write assert renewer health; write includes the current lease ID.
7. Explicit renew waits for renewer acknowledgement.
8. Release is idempotent, serialized with renewal, and stops the renewer.
9. Renewal failure and unexpected child exit reject pending requests and block future operations.
10. A stale lease cannot write after expiry or after a new owner acquires the blob.

Add focused IPC-adapter tests using a fake event-emitting child process. Do not run `renew-fixture-lease.ts` or Azure SDK clients in this suite.

### 2. Happy-path orchestration tests

Add `tests/azure-fixtures/__tests__/provision-workflow-fixture.test.ts`.

Cover:

1. **Cold start:** one workflow writes `Preparing`, creates every group, deploys every Bicep template in manifest order, runs post-provision once, marks every group complete, refreshes expiration, writes `Ready`, releases the lease, and returns the exact mapping.
2. **Ready reuse:** a later workflow validates recorded groups and tags, extends only an earlier/malformed `DeleteAfter`, updates the record expiration, performs no deployment, and returns the recorded instance.
3. **Ready reuse with later expiration:** the later date is preserved and no shortening update is issued.
4. **Complete discovery:** with `Empty` or recoverable `Preparing`, an existing complete instance is selected and published without Bicep deployment.
5. **Duplicate complete discovery:** selection is deterministic, the preferred recorded instance wins when complete, a warning is logged, and complete duplicates are not deleted.
6. **Multiple components:** output IDs, group names, tags, parameters, and deployment order remain associated with the correct manifest component.
7. **Local and CI ownership:** coordination records contain the expected local owner format or `GITHUB_RUN_ID:GITHUB_RUN_ATTEMPT`.

For each success, assert:

- exactly one final `Ready` record;
- every returned group belongs to the returned instance and is `Completed=True`;
- no lease remains held and no renewer remains active;
- no incomplete instance is returned;
- output JSON and in-memory state agree.

### 3. Deterministic concurrency tests

Run real concurrent promises against one fake environment. Coordinate them with barriers rather than relying on event-loop timing.

1. **Simultaneous cold start:** start 2, 10, and 100 actors at the same virtual instant. Pause the winner during deployment. Confirm one attempt deploys, all others remain behind the lease, and all successful calls return the same instance.
2. **Follower after ready publication:** release contenders one at a time after `Ready`; each validates and reuses without deployment.
3. **Acquisition timeout:** hold the lease beyond one follower's budget. The follower fails and executes zero ARM mutations.
4. **Long deployment with renewal:** advance through several lease durations while renewal succeeds. No contender can acquire or deploy.
5. **Lease loss during deployment:** expire/fail renewal, let another actor acquire after retry spacing, and confirm the stale owner cannot mark groups complete or publish `Ready`.
6. **Owner crash after `Preparing`:** stop the owner before group creation, advance past `nextAttemptNotBefore`, and confirm exactly one replacement attempt is started.
7. **Owner crash after partial deployment:** leave one or more incomplete groups, then recover. Incomplete old groups are scheduled for deletion, replacement names are unique, and components from old and new instances are never mixed.
8. **Many contenders after failure:** after a failed attempt, release 100 waiting actors. Shared retry spacing permits one replacement attempt rather than one attempt per waiter.
9. **Accepted duplicate race:** seed two complete instances as the documented rare condition. Every call pins one deterministic complete instance, with no mixed mapping.

Record cohort metrics in assertions:

- number of lease acquisition attempts;
- number of provisioning attempts;
- number of Bicep deployments per component;
- number of distinct returned instance IDs;
- maximum concurrent active lease holders;
- stale write rejection count;
- incomplete groups scheduled for cleanup.

Normal simultaneous cold start must produce one provisioning attempt and one returned instance. Recovery scenarios may produce an additional attempt only where explicitly expected.

### 4. Failure-mode matrix

Use table-driven tests where the expected behavior is common.

| Failure point | Expected result |
|---|---|
| Missing storage account/container environment variable | Fail before storage or ARM activity |
| Account/principal lookup | Fail before lock initialization |
| Blob initialization unexpected error | Fail before lease acquisition |
| Lease acquisition non-contention error | Fail; no ARM mutation |
| Malformed/unsupported coordination record | Fail; do not treat as `Empty` |
| Record identity/version mismatch | Fail; no discovery or deployment |
| Discovery CLI failure | Fail; do not authorize replacement |
| Malformed ownership tags | Fail; do not combine or replace |
| Duplicate group for one instance/component | Fail as ambiguous |
| Ready group missing | Fail with manual-repair diagnostic |
| Ready group tag mismatch/incomplete | Fail with manual-repair diagnostic |
| Resource-group creation failure | Leave `Preparing`; release lease; return no output |
| Bicep deployment failure/timeout | Leave attempt incomplete; release lease; return no output |
| Post-provision failure | Never mark complete or publish `Ready` |
| Completion tag update failure | Never publish `Ready` |
| Expiration refresh failure | Never publish/refresh `Ready` |
| Final lease renewal failure | Never publish `Ready` |
| Final record write rejected due to stale lease | Fail; preserve the newer owner's record |
| Explicit release failure after success path | Surface according to the chosen contract and prove the renewer stops |
| Release failure while handling another error | Preserve the original error and log release failure |
| Cleanup scheduling failure | Warn and continue recovery without claiming deletion succeeded |
| Budget exhausted before an Azure step | Fail before issuing that step |
| Azure operation exceeds budget | Report the named timed-out step |

For every injected failure, assert the last valid coordination record, exact Azure mutations completed, lease/renewer cleanup, logs, and absence of success-shaped output.

### 5. Command-contract tests

Assert exact argument vectors generated for each mocked CLI operation, including:

- service-principal versus signed-in-user lookup;
- resource-group tags and quoted `DeleteAfter`;
- resolved Bicep path, deployment name, parameters, and computed `location`;
- `group delete --yes --no-wait`;
- `group update` for `Completed` and `DeleteAfter`;
- `subjectToBudget: false` only for abandoned-group deletion.

These tests protect the deterministic fake from becoming more permissive than production and catch accidental Azure command changes.

## Evaluation rules and invariants

Every orchestration test should evaluate these invariants:

1. At most one active lease exists for the coordination blob.
2. Every coordination write is authorized by the active lease ID.
3. No ARM mutation begins without a held, healthy lease.
4. A workflow returns only after a valid `Ready` record exists.
5. Returned components all belong to one complete instance.
6. A stale owner never overwrites a newer owner's coordination record.
7. Post-provision or completion failures never expose an instance.
8. Waiting or timed-out contenders never deploy without ownership.
9. Complete duplicate instances are not destructively cleaned up.
10. Every settled call leaves no local renewer, timer, waiter, or held lease.

Create one helper such as `expectEnvironmentConsistent(fakeAzure)` to check global invariants after each scenario, including rejected scenarios.

## Implementation sequence

1. Extract the dependency interfaces without changing production behavior.
2. Add the fake clock, blob/lease store, CLI dispatcher, renewer, operation journal, barriers, and fault rules.
3. Add resource-lock unit tests and make them pass.
4. Add single-workflow happy-path and failure tests.
5. Add two-actor concurrency tests, then scale the same scenarios to 10 and 100 actors.
6. Add table-driven fault coverage and command-contract tests.
7. Add invariant checks to every test and verify no test can reach a real Azure boundary.
8. Run the focused suite repeatedly with randomized actor start order using a printed seed; retain deterministic UUID, time, and fault schedules for reproduction.

## Local commands

Run from `tests/`:

```bash
npm test -- azure-fixtures/__tests__/resource-lock.test.ts azure-fixtures/__tests__/provision-workflow-fixture.test.ts
npm run typecheck
npm run lint
```

Repeat the concurrency suite to detect leaked global state while keeping each run deterministic:

```bash
for seed in 1 2 3 4 5; do
  FIXTURE_TEST_SEED="$seed" npm test -- azure-fixtures/__tests__/provision-workflow-fixture.test.ts
done
```

No Azure login, subscription, storage account, resource group, network access, or Bicep installation should be required. The test setup must clear relevant Azure and GitHub environment variables and provide only scenario-specific values.

## Exit criteria

The local workflow-scope fixture suite is complete when:

- all Azure/storage/process boundaries are mocked and guarded against accidental real calls;
- all happy paths, concurrency situations, and failure points above are covered;
- the 100-contender cold-start test consistently produces one normal provisioning attempt;
- lease loss and stale-owner tests prove stale coordination writes are rejected;
- every failure returns no fixture output and leaves recoverable state;
- focused tests, TypeScript typecheck, and ESLint pass;
- five seeded repetitions pass without open handles, real-time sleeps, network calls, or order-dependent failures.
