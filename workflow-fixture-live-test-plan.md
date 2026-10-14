# Workflow Fixture Live Azure Test Plan

## Goal

Validate the workflow-scope fixture provisioning path locally against real Azure resources.

The test should prove that `provisionWorkflowManifest` can:

- authenticate with the current Azure CLI and Azure SDK credentials;
- create and lease the coordination blob;
- create resource groups without deploying IaC;
- run a post-provision script that tags each resource group through Azure CLI;
- publish a `Ready` coordination record;
- return the expected fixture identity and component mapping;
- reuse the existing fixture on a second invocation without redeploying it;
- serialize concurrent invocations so only one fixture instance is created;
- recover from selected abandoned or inconsistent states;
- leave no untracked resources after cleanup.

This is an opt-in integration test. It must never run as part of the default unit-test suite or CI without an explicitly configured Azure test subscription.

## Current implementation constraints

The live test must account for these facts:

1. `provisionWorkflowManifest` is an exported TypeScript function, not a standalone command.
2. Workflow manifests are not yet loaded by the Vally executor.
3. The provisioner always runs:
   - `az account show`;
   - `az ad signed-in-user show` for a local user, or `az ad sp show` for a service principal;
   - resource-group and deployment commands.
4. Coordination uses `DefaultAzureCredential`, while resource provisioning uses the Azure CLI. Both must resolve to the same tenant and subscription.
5. The coordination storage account and container must already exist.
6. Fixture resource groups receive a 48-hour `DeleteAfter` tag, but the local test must clean them up immediately.
7. A manifest identity is the tuple of subscription, tenant, manifest ID, and manifest version. Reusing the same identity intentionally reuses the same coordination blob and fixture.

## Safety boundaries

- Use a non-production subscription dedicated to development or integration tests.
- Use a unique manifest ID such as `workflow-fixture-local-<developer>-<date>`.
- Use a dedicated coordination resource group, storage account, and private container.
- Do not use an existing production coordination container.
- Use a low-cost fixture and delete it at the end of the test.
- Record every created resource ID before running destructive scenarios.
- Restrict cleanup queries to the unique manifest ID and test resource-group prefix.
- Preview cleanup targets and require explicit confirmation before deleting resources.
- Do not print access tokens, storage keys, connection strings, or full credential diagnostics.
- Stop immediately if the active tenant or subscription differs from the intended test target.

## Azure resources

### Persistent test infrastructure

Create once and reuse across local runs:

- resource group: `rg-ghcfa-fixture-coordination-<suffix>`;
- general-purpose v2 storage account with standard locally redundant storage;
- private blob container named `workflow-fixtures`;
- role assignment granting the test identity `Storage Blob Data Contributor` on the storage account.

The current identity also needs permission to:

- create and delete resource groups at subscription scope;
- create deployments and resources in those groups;
- read its own Entra principal object.

Prefer a narrowly scoped test subscription. Do not broaden production permissions solely for this test.

### Per-test fixture

The live manifest creates two resource-group-only components:

- `rg-ghcfa-wf-live-primary-1-<suffix>`;
- `rg-ghcfa-wf-live-secondary-1-<suffix>`.

Neither component has a Bicep `path`, so provisioning creates only the resource groups. The post-provision script adds `LiveTestPostProvisioned=True` to both groups through Azure CLI.

## Test artifacts to add

The following opt-in test assets are under `tests/azure-fixtures/live/`:

1. `workflow-fixture-live.manifest.json`
   - uses the local-only manifest ID `workflow-fixture-local-live`;
   - uses manifest version `1`;
   - declares two resource-group-only configs in `eastus2`;
   - runs `tag-resource-groups.ts` after both groups are created.
2. `tag-resource-groups.ts`
   - receives the provisioned groups through `--resource-groups`;
   - adds `LiveTestPostProvisioned=True` to every group using `az group update`.
3. `provision-workflow-fixture-live.ts`
   - reads the workflow manifest;
   - calls `provisionWorkflowManifest`;
   - validates and prints only non-secret output;
   - exits non-zero on any mismatch.
4. Optionally, `provision-workflow-fixture.live.test.ts`
   - runs only when `RUN_LIVE_AZURE_FIXTURE_TESTS=true`;
   - otherwise skips the suite;
   - is never selected by the default `npm test` command in CI.

Prefer the dedicated harness first. Convert it into a Vitest live test only after the manual flow is stable.

## Phase 1: local and Azure preflight

Run from the repository root unless noted otherwise.

### 1. Verify local dependencies

```bash
node --version
npm --version
az version
```

Expected:

- Node satisfies `tests/package.json`;
- dependencies under `tests/` are installed;
- Azure CLI is available.

### 2. Verify the active Azure context

```bash
az account show --query '{subscription:id,subscriptionName:name,tenant:tenantId,user:user}' -o json
az ad signed-in-user show --query '{id:id,userPrincipalName:userPrincipalName}' -o json
```

For service-principal authentication, replace the second command with:

```bash
az ad sp show --id '<client-id>' --query '{id:id,appId:appId}' -o json
```

Record the intended subscription ID and tenant ID. Stop if they do not match the isolated test subscription.

### 3. Verify the target region

The manifest creates both resource groups in `eastus2`. Update the manifest before running if subscription policy requires another region.

### 4. Create or verify coordination infrastructure

Create the dedicated resource group, storage account, and private container using normal Azure CLI commands. Save their names locally as:

```bash
export AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT='<storage-account-name>'
export AZURE_FIXTURE_COORDINATION_CONTAINER='workflow-fixtures'
```

Verify data-plane access through Entra ID rather than storage keys:

```bash
az storage blob list \
  --auth-mode login \
  --account-name "$AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT" \
  --container-name "$AZURE_FIXTURE_COORDINATION_CONTAINER" \
  --num-results 1 \
  -o json
```

If this fails with authorization errors, fix the `Storage Blob Data Contributor` assignment and allow time for RBAC propagation before testing the provisioner.

### 5. Run repository checks before live deployment

From `tests/`:

```bash
npm test -- azure-fixtures/__tests__/resource-lock.test.ts azure-fixtures/__tests__/provision-workflow-fixture.test.ts
npm run typecheck
npm run lint
```

Do not proceed to Azure if the existing deterministic tests fail.

## Phase 2: cold-start deployment

### 1. Capture the baseline

Before invoking the harness, capture:

- existing blobs under the `workflow-fixtures/` prefix;
- resource groups tagged with the unique workflow fixture ID;
- current UTC time;
- active subscription and tenant.

There should be no resource group or coordination record for a brand-new manifest identity.

### 2. Run one provisioning invocation

From `tests/`:

```bash
cd tests

export RUN_LIVE_AZURE_FIXTURE_TESTS=true
export AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT='<storage-account-name>'
export AZURE_FIXTURE_COORDINATION_CONTAINER='workflow-fixtures'

npx tsx ./azure-fixtures/live/provision-workflow-fixture-live.ts \
  > /tmp/workflow-fixture-live-single.log 2>&1

single_exit=$?
cat /tmp/workflow-fixture-live-single.log
echo "exit=$single_exit"
```

The harness refuses to run unless `RUN_LIVE_AZURE_FIXTURE_TESTS=true`. A successful command exits `0` and prints JSON containing `fixtureId`, `fixtureVersion`, `fixtureInstanceId`, `resourceGroups`, and `resourceGroupIdsByComponent`.

Expected behavior:

1. account and principal discovery succeed;
2. the coordination blob is initialized;
3. one 60-second lease is acquired;
4. a `Preparing` record is written;
5. one resource group is created;
6. the post-provision script adds `LiveTestPostProvisioned=True` to both groups;
7. both resource groups are tagged `Completed=True`;
8. expiration is set approximately 48 hours ahead;
9. the coordination record becomes `Ready`;
10. the lease is released;
11. output contains one fixture instance ID and one component-to-resource-group ID mapping.

### 3. Verify Azure state independently

Use Azure CLI to verify, rather than trusting harness output alone:

- exactly one resource group has the unique `WorkflowFixtureId`;
- its `FixtureVersion`, `FixtureInstanceId`, `FixtureComponent`, `Completed`, and `DeleteAfter` tags are correct;
- both groups have `LiveTestPostProvisioned=True`;
- neither group contains child resources created by this test;
- the coordination blob JSON is `Ready`;
- its instance ID and resource-group ID match the resource-group tags and harness output;
- the blob has no active lease after the process exits.

Do not include secrets or storage keys in captured evidence.

## Phase 3: ready-fixture reuse

Run the same harness again without changing the manifest ID or version.

Expected:

- the same fixture instance ID and resource-group mapping are returned;
- no new resource group is created;
- no new resource group is created;
- the `DeleteAfter` tag and coordination `expiresAt` are refreshed or preserved at a later value;
- the coordination lease is released.

Compare resource-group IDs, deployment counts, and coordination records from both runs.

## Phase 4: real concurrency

Start two harness processes with the same manifest identity and coordination settings:

```bash
cd tests
./azure-fixtures/live/run-concurrent-workflow-fixture-live.sh --concurrency 2
```

The exported `RUN_LIVE_AZURE_FIXTURE_TESTS`, `AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT`, and `AZURE_FIXTURE_COORDINATION_CONTAINER` values from the single-run setup must still be present.

Expected:

- both processes succeed;
- only one fixture instance is deployed;
- both return the same fixture instance ID and resource-group mapping;
- at most one coordination lease is active at a time;
- the losing contender waits and then reuses `Ready`;
- no child lease-renewal process remains after both parents exit.

After the two-process test is stable, repeat with five concurrent processes:

```bash
./azure-fixtures/live/run-concurrent-workflow-fixture-live.sh --concurrency 5
```

The runner stores each process's output and exit code in a timestamped temporary directory, prints every log, exits `1` if any process fails, and prints the log directory for later inspection. All successful outputs should contain the same `fixtureInstanceId` and resource-group mapping.

## Phase 5: controlled recovery tests

Run recovery tests one at a time. Inspect and record state before each mutation.

### Scenario A: complete resource group, non-Ready record

After a successful deployment:

1. retain the completed resource group;
2. replace the coordination record with a valid `Preparing` record for the same instance;
3. run the harness.

Expected:

- discovery selects the completed instance;
- no resource group is recreated;
- the record is repaired to `Ready`;
- the same mapping is returned.

### Scenario B: incomplete abandoned instance

Use a new manifest version to isolate the scenario:

1. seed a valid `Preparing` record whose retry time is in the past;
2. create a matching resource group with ownership tags but without `Completed=True`;
3. run the harness.

Expected:

- the abandoned group is scheduled for deletion with `--no-wait`;
- a new fixture instance is provisioned;
- the returned mapping contains only the replacement instance;
- the coordination record becomes `Ready`.

### Scenario C: missing resource group referenced by Ready

Use another manifest version:

1. seed a syntactically valid `Ready` record referencing a nonexistent group;
2. run the harness.

Expected:

- provisioning fails with a manual-repair diagnostic;
- it does not silently replace or mix resources;
- no success-shaped output is returned;
- the lease is released.

Do not run lease-kill, process-crash, or network-fault tests against real Azure until the three scenarios above pass. Those failure modes remain better covered by deterministic unit tests.

## Cleanup

Cleanup is part of every live test run, including failed runs.

### 1. Inventory

List candidate resource groups by both:

- the exact unique `WorkflowFixtureId` tag;
- the exact expected resource-group prefix.

The two lists must agree. If they do not, stop for manual review.

List the exact coordination blob associated with the test manifest identity. Do not delete the container or shared coordination storage account during per-test cleanup.

### 2. Confirm destructive actions

Display:

- subscription ID;
- tenant ID;
- every resource-group name and ID;
- the exact coordination blob name;
- the manifest ID and version.

Require explicit confirmation before deletion.

### 3. Delete

After confirmation:

1. delete only the listed fixture resource groups;
2. wait for deletion completion;
3. delete only the test coordination blob;
4. remove temporary logs and harness output containing Azure resource IDs if no longer needed.

Keep the dedicated coordination storage infrastructure only if future local tests will reuse it. Otherwise, inventory it separately and delete its resource group after another explicit confirmation.

### 4. Verify cleanup

Confirm:

- no resource group remains with the test workflow fixture ID;
- the exact coordination blob no longer exists;
- no lease-renewer child process remains;
- the active subscription and tenant were not changed by the test;
- no unexpected resources were created.

## Evidence to retain

For each scenario, record:

- date and operator;
- commit SHA and dirty-worktree status;
- tenant and subscription IDs, with subscription name;
- manifest ID and version;
- selected region;
- harness command and exit code;
- fixture instance ID;
- resource-group IDs;
- deployment name and provisioning state;
- coordination state before and after;
- whether cleanup completed;
- links to any Azure activity-log events needed for troubleshooting.

Do not retain tokens, credentials, connection strings, storage keys, or unredacted environment dumps.

## Exit criteria

The live Azure validation is complete when:

- deterministic unit tests, typecheck, and lint pass;
- cold start creates exactly one complete fixture and publishes `Ready`;
- a second run reuses the exact fixture without another deployment;
- two and then five concurrent runs converge on one fixture instance;
- complete-instance discovery repairs a non-Ready record without redeployment;
- an abandoned incomplete instance is replaced without mixing components;
- a broken `Ready` record fails safely with a manual-repair diagnostic;
- every invocation releases its blob lease and child renewer;
- all fixture resource groups and test coordination blobs are removed;
- retained evidence contains no secrets.

## Recommended execution order

1. Review the resource-group-only manifest, post-provision tag script, and opt-in harness.
2. Run deterministic repository checks.
3. Prepare and verify isolated coordination infrastructure.
4. Run cold start and inspect Azure state.
5. Run reuse.
6. Run two-process concurrency, then five-process concurrency.
7. Run controlled recovery scenarios with separate manifest versions.
8. Clean up and verify zero residual fixture resources.
9. Document results and any deviations from expected behavior.
