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
  "aggregate": {
    "readyDeviceCount": 12,
    "readyWithWarningsDeviceCount": 7,
    "blockedDeviceCount": 1,
    "failedBatchCount": 0,
    "assignedDeviceCount": 8,
    "intendedHubMatchCount": 8,
    "intendedHubMismatchCount": 0,
    "blockers": [
      {
        "registrationId": "device-017",
        "checkId": "x509.registrationIdentity",
        "message": "The certificate identity does not match the registration ID."
      }
    ],
    "warnings": [
      {
        "checkId": "x509.certificateValidity",
        "message": "One or more certificates expire within 30 days.",
        "affectedDeviceCount": 7
      }
    ],
    "executionFailures": []
  },
  "resource": {
    "subscription": "<subscription>",
    "resourceGroup": "<resource-group>",
    "service": "<dps>",
    "enrollmentGroupId": "<group>"
  }
}
```

After every completed batch, update the cursor and the non-secret aggregate in one checkpoint write.
The aggregate must retain completed batches' readiness counts, assignment counts, deduplicated
findings, exception device IDs, and execution failures. Do not retain complete MCP responses or
routine per-device evidence.

Do not store certificate chains, TPM endorsement keys, private keys, symmetric keys, connection
strings, tokens, or credentials in checkpoints. On resume:

1. Verify the source hash and resource context.
2. Restore the aggregate before processing another batch.
3. Continue at `nextBatchIndex` without recounting or discarding completed batches.
4. Include restored and newly processed results in the final fleet report.

## Failure handling

- A failed batch is an execution failure, not a device blocker.
- Do not mark unassessed devices ready or blocked.
- Report processed, remaining, and failed counts.
- Provide the exact resume instruction.
- State that this is agent-session orchestration, not a durable DPS service job.
