# Scope resolution

## Discovery

Use the Azure MCP subscription-list operation once when accessible subscriptions are needed.
Consume its returned IDs directly. Use `az account show` or `az account list` only if MCP
subscription listing fails, and mark that fallback unverified. Do not expose credentials or raw
authentication errors.

For Cost + IdleResources analysis, call the dedicated Advisor
`advisor_recommendation_service_group_scope` operation. Do not reproduce its Resource Graph
query in the skill or call the generic ARM router. The MCP operation owns tenant resolution,
Service Group discovery, pagination, and truncation reporting. It returns a
`results.serviceGroups` collection; use the returned identifiers for subsequent Advisor filters
and display names when the operation provides them. An empty collection means no Service Groups
were returned by the operation; it is not evidence that recommendations are unavailable for
every other scope.

Use this direct operation payload:

```json
{
  "command": "advisor_recommendation_service_group_scope",
  "intent": "Discover direct child Azure Advisor Service Groups available for Cost and IdleResources analysis",
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
After scope selection, load `azure-advisor-cost-optimization` immediately only for
`category=Cost` plus `sub-category=IdleResources` analysis, savings, lifecycle reporting,
deletion estimates, or cost-scoped remediation artifacts. Generic Cost, prioritized Cost that
does not explicitly target `IdleResources`, cross-category, and non-Cost requests return to
`azure-advisor` and use the generic Advisor workflow; state-changing remediation then continues
through `azure-advisor-actionability` as appropriate. Do not invoke recommendation tools from
this context skill. The cost workflow's direct-list path must preserve both filters.
