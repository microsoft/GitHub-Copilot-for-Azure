# Tools, filters and recovery

Use existing Advisor operations. Never invent cost-specific tools, SG discovery/membership,
scope-only summary or alternative deletion-validation tools. SG resolution belongs to existing tools;
ask for an ID only after their scope failure. Inspect connected schemas before newer inputs.
If required scope inputs or `summary.cost` are absent, report an updated MCP server is needed;
never substitute default scope or capped totals.

In consolidated mode, list, summary and prevalidate share
`list_azure_advisor_recommendations`; they are not separately exposed tools.
Use the connected schema to select the operation.

Prevalidation probes ARG change history only for resources blocked by a failed scope/detection
check. A confirmed Delete event adds `resourceDeletedOn`, a no-action `reason`, and
`canPostponeDismiss=false`; the resource stays blocked and the summary separately counts it
in `deletedCount`. Unknown, inaccessible, or older-than-14-day history is not proof of deletion.
Do not infer deletion from a timestamp in ordinary savings metadata or run a separate probe.

| Tool | Contract |
|---|---|
| `advisor_recommendation_summary` | Selected scope, Cost/IdleResources; grouping/status/priority/filters/dates/top |
| `advisor_recommendation_list` | Same scope/filters; status/type IDs/resource filters/top; single-type priority |
| `advisor_recommendation_prevalidate` | One exact recommendation-type-id; same scope/tenant; optional exact resources, resource substring, top (1-25, default 25), minimum-unused-days (1-365, default 30). Cost/IdleResources/New enforced internally; no category, sub-category or status inputs |
| `advisor_recommendation_update` | Stable recommendation ID, one scope, intended status; confirmation, date/reason, tenant |
| `advisor_metadata_list` | Resolve recognizable recommendation names using supported metadata filters |
| `advisor_remediation_get` | Selected recommendationTypeId; actionability only, not discovery |

```javascript
const parameters = {
  "subscriptions": ["<resolved-subscription-id>"],
  "category": "Cost",
  "sub-category": "IdleResources",
  "prioritized": true
};
// For SG, replace subscriptions with "service-group": "<supplied-name-or-id>".
```

Frequency/count/grouping uses normal summary and requested group-by; both modes return Cost.
Keep scalar subscription/type/resource options. Read arrays use OR within each filter;
subscription and SG scope cannot combine. `minimum-savings` is non-negative annual retail USD
potential savings, not monthly/contractual. Summary as-of/from/to require Cost and UTC ISO 8601;
from <= to, no future as-of. List has no historical inputs.

Use the connected schema for supported filter values and limits.
Map friendly wording to a supported product family only when unambiguous; no provider mappings.
Only send fully qualified resource-type(s) when supplied. For unresolved recognizable names
or empty family-filtered results, resolve stable IDs with metadata_list, retry and disclose
fallback. Search matches instance problem text, not metadata labels.
Preserve product-family with prioritization; filtering precedes totals/ranking.
Prioritized summary groups by type; prioritized list requires one scalar recommendation-type-id.
Summary limits affect displayed groups, not Cost totals.
Capped list rows cannot establish full population or totals; leave optional defaults to the tool.

| Situation | Response |
|---|---|
| Empty result/missing measure | No matching findings or Unavailable; preserve explicit zero |
| Truncation/partial scope | Disclose partial coverage, never completeness |
| Authentication/tenant/scope failure | Safely report failed scope, never default-subscription fallback |
| Malformed/incomplete summary failure | Surface error, not partial/zero-valued success |
| Partial update failure | Separate successful/failed selected records |
| Requested basis absent | Explain limitation, preserve returned basis |
| Explicit deletion safety requested | [Prevalidation](selection-and-handoff.md#read-only-prevalidation); automated evidence and manual checks, never deletion authorization |
| Prevalidation missing from connected schema | Updated MCP server required; never fabricate a verdict or substitute direct checks |

After Advisor errors never substitute billing, Cost Management, ARM, CLI or runtime KQL.
Subscription-discovery exception is defined in [Scope resolution](scope-resolution.md).
Preserve unknown money; no reconstruction from daily rates or dates.
