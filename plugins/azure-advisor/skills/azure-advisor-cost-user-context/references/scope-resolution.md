# Scope resolution

## Discovery

Use the Azure MCP subscription-list operation once when accessible subscriptions are needed.
Consume its returned IDs directly. Use `az account show` or `az account list` only if MCP
subscription listing fails, and mark that fallback unverified. Do not expose credentials or raw
authentication errors.

Advisor Service Groups are discovered from Advisor recommendation records using this pre-authored
Resource Graph query:

```kusto
advisorresources
| where type =~ "microsoft.advisor/recommendations"
| where tolower(id) startswith "/providers/microsoft.management/servicegroups/"
| project serviceGroupId = tolower(
    extract(@"/providers/microsoft.management/servicegroups/([^/]+)", 1, tostring(id)))
| where isnotempty(serviceGroupId)
| distinct serviceGroupId
| order by serviceGroupId asc
```

Call the dedicated Advisor `advisor_recommendation_service_group_scope` operation; do not call the generic ARM router.
The operation owns this query and returns a `results.serviceGroups` collection. Extract each
entry's `serviceGroupId` (or accept a string entry for older result shapes); an empty or
unrecognized field is not a zero-group result. A group with no recommendation records is not
evidence that it is inaccessible; report that this discovery identifies observed Advisor Service
Groups only.

Use this direct operation payload:

```json
{
  "command": "advisor_recommendation_service_group_scope",
  "intent": "Discover observed Azure Advisor Service Group IDs from Advisor recommendation records",
  "parameters": {}
}
```

## Handoff

For all subscriptions, pass every accessible subscription ID. For all Service Groups, pass every
resolved group ID and the subscription coverage. Never pass `[]`, omit scope, or silently narrow
to the default subscription. Preserve denied scopes, unresolved names, and truncation in the
handoff and final response.

If both a subscription and Service Group are supplied, render the detected scope options and any
relevant access or truncation state before asking the user to choose one scope family.
After scope selection, load `azure-advisor-cost-optimization` immediately for Advisor
cost/idle-resource analysis, savings, postpone, dismiss, deletion estimates, or
cost-scoped remediation artifacts. Do not route back to a generic cost skill or invoke
recommendation tools from this context skill. For non-cost Advisor remediation or artifact
requests, return the resolved scope to `azure-advisor` and then
`azure-advisor-actionability` without loading cost optimization. The cost workflow's
direct-list path must preserve `category=Cost` and `sub-category=IdleResources`.
