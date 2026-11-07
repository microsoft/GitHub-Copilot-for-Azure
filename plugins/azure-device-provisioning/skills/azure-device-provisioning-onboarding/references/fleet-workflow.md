# Fleet Workflow

Use this workflow only for more than 10 devices or when the user explicitly requests checkpoint and
resume behavior.

## Batch

1. Validate the complete source manifest using the safety rules in
   [Validation workflow](validation-workflow.md).
2. Split devices in source order into deterministic batches of at most 10.
3. Call `deviceprovisioning_onboarding_validate` once per batch.
4. Stop if the visible DPS or enrollment configuration changes between batches.
5. Aggregate counts and shared findings; retain device IDs only for blockers, assignment
   mismatches, unique warnings, and execution failures.

Never silently process only the first 10 devices.

## Checkpoint

Persist operational state without identity evidence:

```json
{
  "schemaVersion": 1,
  "status": "inProgress",
  "sourceManifestPath": "<path>",
  "sourceManifestSha256": "<sha256>",
  "nextBatchIndex": 2,
  "processedDeviceCount": 20,
  "totalDeviceCount": 100,
  "resource": {
    "subscription": "<subscription>",
    "resourceGroup": "<resource-group>",
    "service": "<dps>",
    "enrollmentGroupId": "<group>"
  }
}
```

Do not store certificate chains, TPM endorsement keys, private keys, or credentials in checkpoints.
On resume, verify the source hash and resource context before continuing.

## Failure handling

- A failed batch is an execution failure, not a device blocker.
- Do not mark unassessed devices ready or blocked.
- Report processed, remaining, and failed counts.
- Provide the exact resume instruction.
- State that this is agent-session orchestration, not a durable DPS service job.
