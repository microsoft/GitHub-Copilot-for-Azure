# Live AKS Evaluation Integration with Azure Fixtures

## Context

PR #3147 added a generic Azure fixture framework that can provision Azure resources from Bicep. The Azure Diagnostics live evaluation suite uses an AKS cluster, but it also injects and reverses multiple Kubernetes faults during a single evaluation run.

The fixture framework can provision the underlying AKS cluster. The remaining gap is support for multiple stateful, reversible scenarios that share one ephemeral resource while remaining isolated from each other.

## Current live scenarios

The three diagnostic scenarios are not built into the fixture framework:

| Current live scenario | Fault created by the suite | Capability not provided by #3147 |
|---|---|---|
| CoreDNS scheduling failure | Taint every node, delete the CoreDNS pods, and wait until their replacements are `Pending`. | Per-stimulus fault injection and guaranteed removal of the node taint. |
| Service has no endpoints | Create a Deployment and a Service whose selector intentionally does not match the pods. | Per-stimulus Kubernetes setup and namespace cleanup. |
| NetworkPolicy blocks DNS | Start a healthy DNS client, wait for it to become ready, and then apply an egress policy that omits TCP and UDP port 53. | Ordered setup, fault activation after workload readiness, and per-stimulus cleanup. |

## Required lifecycle

The live suite currently needs to:

1. Provision one ephemeral AKS cluster per evaluation run.
2. Run all three stimuli serially against that cluster.
3. Before each stimulus, inject its specific fault and verify that the expected broken state exists.
4. After each stimulus, restore the cluster to a clean state.
5. Reuse the restored cluster for the next stimulus.
6. Delete the cluster synchronously after the suite, including when a test fails.

The hooks introduced by #3147 are fixture-level rather than a natural `beforeEach` and `afterEach` lifecycle around individual stimuli.

With ordinary non-persistent fixtures, each stimulus could receive a separate AKS cluster. With `persist: true`, the stimuli could share a cluster, but the framework does not provide serialization, locking, clean-state verification, or reliable per-scenario rollback.

The gap is therefore not AKS provisioning. It is supporting multiple stateful, reversible fault scenarios that share one ephemeral resource with isolation between stimuli.

## Implementation options

| Approach | Effort | Result |
|---|---|---|
| Adapt #3147 for the live AKS suite | Small to medium | Reuse the existing provisioner while retaining workflow-owned serial execution and final cleanup. |
| Add general suite-scoped fixture support | Medium to large | Provide a reusable framework for AKS and other expensive, mutable fixtures. |

### Targeted adaptation

A targeted integration would:

1. Add an `azure-manifest.json` for the AKS Bicep deployment.
2. Invoke the #3147 provisioner once from the workflow.
3. Obtain AKS credentials after provisioning.
4. Continue using `manage-scenario.sh setup/cleanup` to run the scenarios serially.
5. Invoke fixture cleanup synchronously from an unconditional final workflow step.

This removes duplicate resource-group and Bicep deployment logic without significantly changing the fixture framework. Scenario orchestration remains in the live-test workflow.

### General suite-scoped extension

A reusable framework extension would need to:

- Add fixture scope, such as `stimulus` or `suite`.
- Move fixture ownership above individual stimulus execution.
- Guarantee serial execution for mutable shared fixtures.
- Add per-stimulus `beforeEach` and `afterEach` hooks.
- Pass Bicep outputs, such as the AKS cluster name, into hooks and agent context.
- Prevent concurrent workflow runs from accidentally sharing a mutable fixture.
- Guarantee synchronous cleanup after success, failure, or cancellation.
- Add schema validation, tests, and documentation while preserving existing per-stimulus behavior.

This is not a small configuration change. The principal complication is suite finalization: each stimulus is currently processed independently, so an individual executor does not naturally know when the complete suite has finished.

## Suite finalization

Suite finalization should be owned by the component that starts the entire Vally run, not by an individual stimulus executor.

```text
workflow job
|-- provision fixture once
|-- obtain AKS credentials
|-- run stimulus 1
|   |-- scenario setup
|   |-- Vally evaluation
|   `-- scenario cleanup
|-- run stimulus 2
|   |-- scenario setup
|   |-- Vally evaluation
|   `-- scenario cleanup
|-- run stimulus 3
|   |-- scenario setup
|   |-- Vally evaluation
|   `-- scenario cleanup
`-- always: delete fixture and wait for completion
```

For the current suite, GitHub Actions can own the finalizer:

```yaml
- name: Delete live fixture
  if: always()
  shell: bash
  run: |
    az group delete \
      --name "$RESOURCE_GROUP" \
      --yes

    az group wait \
      --name "$RESOURCE_GROUP" \
      --deleted \
      --timeout 1800
```

For generalized suite-scoped support, `tests/run-vally-test.ts` or a new suite-fixture wrapper should own the lifecycle:

```typescript
const fixture = await provisionFixture(manifest, runId);

try {
  await runVally({
    fixture,
    workers: 1,
  });
} finally {
  await cleanupFixture(fixture, {
    waitForCompletion: true,
  });
}
```

The parent runner would:

1. Generate a unique run ID.
2. Provision the fixture before starting Vally.
3. Expose the resource group and Bicep outputs through environment variables or a generated context file.
4. Force mutable fixture stimuli to execute serially.
5. Wait for the complete Vally process to exit.
6. Clean the fixture in `finally`, regardless of the test result.

## Per-stimulus finalization

Scenario setup and cleanup should remain within each stimulus lifecycle:

```typescript
try {
  await runScenarioHook("setup", stimulus);
  await executeStimulus(stimulus);
} finally {
  await runScenarioHook("cleanup", stimulus);
}
```

There are therefore two cleanup levels:

- **Stimulus finalization:** undo node taints, remove scenario namespaces and policies, and restore cluster health.
- **Suite finalization:** delete the AKS resource group after all stimuli have finished.

Stimuli should not count themselves and allow the apparent last stimulus to delete the fixture. Parallel execution, retries, skipped tests, and process failures make that approach race-prone.

Both `if: always()` and `finally` remain best-effort if a runner is forcibly terminated. Resource groups should also receive run and expiration tags, with scheduled orphan cleanup as a safety net.

## Recommendation

Start with the targeted adaptation:

- Use the #3147 framework to provision the cluster.
- Retain workflow-owned serial scenario orchestration.
- Retain per-scenario setup and cleanup.
- Perform unconditional, synchronous resource-group deletion at the end of the workflow.

General suite-scoped fixture support should be added when another evaluation suite needs the same shared, mutable resource lifecycle. This avoids expanding the public fixture model for a single consumer while still reusing the stable provisioning infrastructure from #3147.
