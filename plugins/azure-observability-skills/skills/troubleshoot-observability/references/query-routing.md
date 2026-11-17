# Query-source boundaries

Select the actual operation and confirmed source before the first schema probe.
These are candidates, not guaranteed schemas:

| Query scope | Table/field candidates |
|---|---|
| Application Insights component | `requests`, `dependencies`, `timestamp`, `duration`, `customDimensions` |
| Log Analytics workspace | `AppRequests`, `AppDependencies`, `TimeGenerated`, `DurationMs`, `Properties` |

A component's backing workspace does not change its component query dialect.
Discover actual tables, columns, key populations and units with the smallest
approved lookup. Discovery, failures, correction and retries consume the same
remaining call budget. Never silently widen scope/time or switch identity.

Use Monitor logs/metrics for application evidence, AppLens for a specific
supported platform diagnostic question, and Resource Health for availability.
Provisioning state is none of these. Correlation is not cause.

Retain source, schema, query/result references, UTC window, units, sampling and
completeness. Bound server-side aggregation and return only needed safe fields.
No raw prompts, connection secrets, full settings or environment dumps.
Missing/denied/empty/stale/partial/failed/throttled outcomes remain distinct.
