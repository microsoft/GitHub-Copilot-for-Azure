# Storage Lifecycle Guidance

Treat these thresholds as candidates, not automatic actions. Verify access
patterns, retention requirements, redundancy requirements, and live prices
before recommending a policy.

## Access tiers

| Last access | Pattern | Candidate |
|-------------|---------|-----------|
| Under 30 days | Frequent reads or writes | Hot |
| 30-90 days | Occasional reads | Cool |
| 90-180 days | Rare reads | Cold |
| Over 180 days | Archival with tolerated rehydration delay | Archive |

Include minimum-retention, retrieval, early-deletion, and rehydration costs.
Do not recommend Archive for data with unpredictable or urgent retrieval.

## Starting policy

```json
{
  "rules": [
    {
      "name": "tier-inactive-base-blobs",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterLastAccessTimeGreaterThan": 30 },
            "tierToArchive": { "daysAfterLastAccessTimeGreaterThan": 180 }
          }
        },
        "filters": { "blobTypes": ["blockBlob"] }
      }
    },
    {
      "name": "delete-expired-copies",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "snapshot": { "delete": { "daysAfterCreationGreaterThan": 90 } },
          "version": { "delete": { "daysAfterCreationGreaterThan": 90 } }
        },
        "filters": { "blobTypes": ["blockBlob"] }
      }
    }
  ]
}
```

`daysAfterLastAccessTimeGreaterThan` requires last-access tracking. Verify it
through an available ARM MCP storage operation. If that evidence is unavailable,
report the policy as a proposal and leave the check unresolved.
