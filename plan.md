# Fundamental assumptions

1. Azure deployments are slow, and can sometimes take long enough to trigger timeout, no matter how big the timeout is.
2. Simple Azure services are stable enough (e.g. Lease Blob) such that we rarely run into server-side issues, such as 500 internal error, 404 not found.
3. Simple Azure services return responses fast enough to not miss a relatively generous timing requirement. For example, although it's technically possible, we don't assume that a Lease Blob operation takes 30 minutes.
4. If we cannot workaround retryable transient issues after retrying, it's reasonable to abort all Azure operations.
5. The local parent-child process lifecycle is stable enough. We don't need to assume the parent or the child process can be killed for now reason, can hang indefinitely or stops emitting data it is supposed to emit. 
6. NodeJS event loop is stable enough for scheduling timed tasks. This means it's very rare to miss a timed task by too much. For example, if I schedule a task to run once every 30 seconds, we can expect that task to be executed approximately every 30 seconds most of the time.
7. It's OK for rare cases to fail to detect concurrently provisioned fixtures, causing multiple instances of the fixture to be provisioned. However, each workflow must consistently use one of the completed instances and the occurrence of such duplicate instances must be probabilistically rare.
8. We expect a large number of concurrent runs of workflows trying to deploy the same fixture. The design must take this into consideration when assessing how many instances of the fixtures will be deployed.
9. The local clock of the computer running the workflow is accurate enough to support coarse level coordination based on global time.

# Workflow-scoped Azure Fixture Provisioning (Copilot)

## Scope and guarantees

A workflow fixture is prepared before any dependent job or stimulus starts. Concurrent runs normally provision one instance and reuse it. Rare abandoned or duplicate instances are acceptable under assumption 7; every workflow must pin one complete instance throughout its execution.

Preparation does not delete the selected ready instance after use. It may delete abandoned, incomplete instances during recovery. Expiration-boundary races remain a documented manual-recovery case.

The coordination mechanism is an Azure Blob Lease. Acquisition is optimistic: contenders attempt acquisition and retry when another owner holds the lease. Once acquired, the lease provides exclusive ownership of the coordination blob, not automatic exclusion of ARM operations.

## Identity and coordination record

- A fixture identity includes the tenant, subscription, and stable manifest ID. Each manifest has a version that changes when its templates or initialization requirements change.
- Use one stable lock blob per identity and version. Manifests sharing mutable resources must use the same coordination identity or must not provision concurrently.
- Every provisioning attempt generates a unique `FixtureInstanceId`. Resource groups and all collision-sensitive resource names must differ between attempts.
- The lock blob contains a small JSON record with `state` (`Empty`, `Preparing`, or `Ready`), manifest version, instance ID, owner workflow run ID, and the exact resource-group IDs keyed by manifest component.
- The record also stores `nextAttemptNotBefore` and, when ready, the expiration time. A `Preparing` record identifies intended group names before any ARM request is submitted.
- Create the blob with `If-None-Match: *`. An already-existing blob is expected; never overwrite or delete it to obtain ownership.
- Every record update supplies the current lease ID. A stale owner cannot publish a different ready instance after losing its lease. Tags support discovery and cleanup; the record identifies the selected instance.
- Missing, malformed, or unsupported existing record content is an explicit error, not an empty fixture.

## Lease acquisition and renewal

1. Acquire a finite 60-second lease. On lease contention, retry with capped exponential backoff and jitter, within the workflow's acquisition budget.
2. Acquisition timeout fails preparation. It never permits provisioning without a lease. Transient service failures receive bounded retries; exhausted retries fail preparation.
3. Start renewal in a child process, normally every 15 seconds. Continue renewal during deployment, initialization, tagging, and publication.
4. A failed renewal may be retried only while the lease can still be considered valid using the last confirmed renewal and a safety margin. Definitive lease loss or exhausted renewal retries stops new Azure mutations, terminates local operation subprocesses, and fails preparation.
5. The renewal child stops when the parent exits or its IPC connection closes. The parent treats an unexpected child exit as a preparation failure. Synchronous main-process work must not block renewal.
6. Explicitly renew immediately before completion updates. In `finally`, release using the held lease ID while renewal is still running, then stop the child. Serialize release with renewal; report release errors without masking the original failure. Never break another owner's lease.

## Preparation algorithm

After acquiring the lease, re-read the coordination record. A pre-acquisition read is never sufficient to authorize deployment.

### Reuse

For a `Ready` record:

1. Read the recorded groups directly. Verify that every required component exists and matches the version and instance ID, with `Completed=True`.
2. A failed lookup is not evidence of absence. Retry transient errors, then fail. Only confirmed missing or inconsistent resources invalidate the record.
3. Refresh each group's `DeleteAfter` to at least 48 hours from reuse, preserving unrelated tags. Never shorten an existing later expiration. Update the record after all updates succeed.
4. Return the pinned instance and exact group IDs. Do not run initialization again on a ready instance unless it is explicitly safe for concurrent consumers.

If a ready record is confirmed invalid, fail preparation with a repair diagnostic rather than silently deleting resources that another workflow may still use.

### Discovery and recovery

For an `Empty` or `Preparing` record:

1. Discover groups matching fixture identity and version, grouped by `FixtureInstanceId` and manifest component. Never combine groups from different instances.
2. Prefer a complete recorded instance; otherwise select a complete candidate deterministically by instance ID. Recheck the exact groups, run idempotent initialization and readiness checks, and publish it as `Ready` before returning it.
3. Duplicate complete candidates produce a warning. Deterministically pin one and leave the others for expiration cleanup; do not delete complete instances that another workflow may have selected.
4. If no complete instance exists, groups belonging to abandoned incomplete attempts may be scheduled for deletion. Lease ownership makes the previous attempt abandoned for coordination purposes, even if its Azure operations are still running.
5. Do not wait for deletion or old deployments to finish before creating a uniquely named replacement. Delayed operations must remain confined to the old instance. Cleanup errors are reported, not interpreted as successful deletion.
6. Before starting a replacement, honor `nextAttemptNotBefore`. Release the lease while waiting, then reacquire and repeat discovery.

Discovery failures, ambiguous component membership, or malformed ownership tags fail preparation rather than authorizing a new deployment.

### Provision

1. Use a bounded provisioning budget that includes deployment, initialization, and readiness checks.
2. Before any ARM request, write a `Preparing` record with the new instance ID and all intended group IDs.
3. Set `nextAttemptNotBefore` to the attempt start plus twice the provisioning budget. This survives crashes and bounds replacement frequency independently of the number of contenders. A successful attempt is reusable immediately; this timestamp restricts new attempts only.
4. Create groups with `FixtureId`, `FixtureVersion`, `FixtureInstanceId`, a component identifier, `Completed=False`, and `DeleteAfter` 48 hours in the future. Do not use `DoNotDelete=True`.
5. Deploy all templates. Run the idempotent post-provision script and explicit readiness checks, including required data-plane and permission propagation checks.
6. Renew the lease explicitly, mark every group `Completed=True`, then write the complete `Ready` record using the lease ID. Partial tagging is not sufficient for workflow use.
7. Refresh expiration at completion so a long deployment does not consume the ready instance's retention period.
8. Return success only after the ready record is published. On failure, report the error and leave the attempt discoverable for recovery; do not return resource context to dependent jobs.

Initialization scripts must target only the attempt's resources. Aborting local processes does not cancel already-submitted Azure operations; unique naming provides isolation. Rare stale tag updates or discovery misses may leave duplicates, but cannot overwrite the selected ready record without its lease.

## Workflow consumption and cleanup

- Preparation returns the identity, version, instance ID, and component-to-resource-group mapping as workflow outputs.
- All dependent jobs use those outputs, or query tags constrained by the pinned instance ID. They must not independently choose an instance.
- The Vally executor resolves workflow-fixture references to this mapping and injects its resource scope into the first user prompt. Missing or incomplete mappings fail the stimulus before agent execution.
- Workflow fixtures are not subject to stimulus-level teardown. Consumers must support shared use through read-only access or per-run isolated mutations; the preparation lease is not a usage lock.
- External cleanup removes expired instances, including older versions and duplicate instances. The workflow does not claim protection from the accepted expiration-boundary race.

## High-concurrency behavior and verification

All contenders use the same lock key. With successful provisioning and discovery, one deployment attempt serves the waiting runs; contention never authorizes additional attempts. Reuse holds the lease only for validation, expiration refresh, and selection. Acquisition budgets must account for this serialized work; overloaded callers may fail rather than deploy independently.

The shared attempt-spacing rule bounds repeated replacements even when many waiting workflows are available. It does not promise exactly-once ARM execution or eventual success for deployments that repeatedly exceed their budget.

Validate:

- A large simultaneous cold-start cohort produces one instance in the normal case.
- Lease contention and acquisition timeout never trigger an unlocked deployment.
- Parent failure, lease loss, deployment timeout, and partial completion recover without mixing instances.
- A stale owner cannot publish the coordination record after another owner acquires the lease.
- Post-provision failure does not expose an instance to consumers.
- Duplicate discovery selects one complete instance consistently within each workflow.
- Transient discovery failures do not trigger replacement, and shared retry spacing survives crashes.
- Workflow fixtures receive prompt context but are excluded from stimulus teardown.

Log identity, instance ID, owner run, lease failures, deployment attempts, duplicate discovery, and recovery decisions. Measure duplicate frequency and contention under realistic concurrency rather than assuming that a rare per-operation failure remains rare across the whole cohort.
