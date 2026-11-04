---
name: azure-advisor-cost-user-context
description: "Resolve Azure scope before Advisor cost analysis or remediation artifacts. WHEN: unused or idle Azure resources, Advisor cost findings, savings, \"postpone those that require more work\", \"dismiss those that I cannot delete now\", \"stop showing me this one\", \"we are keeping these\", removal requests, deletion preparation, scripts, IaC, pipelines, or accessible Advisor subscriptions and Service Groups. Resolve scope before actionability."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Advisor Cost User Context

This is the mandatory first step for every Azure Advisor cost or idle-resource request. Resolve
tenant, subscriptions, Service Groups, and the selected scope before loading or calling any
recommendation or cost tool. Do not use generic inventory for scope discovery.

Reuse explicit scope from the conversation. A subscription GUID or named subscription phrase is
explicit scope. A named Service Group, `<name> SG`, `<name> Service Group`, or
`in the <name> service group` is explicit scope. Resolve that name directly; if it cannot be
resolved, ask only for its ID/name.

For a genuinely unscoped request, ask exactly one scope question with:
`Specific subscription(s) (Recommended)`, `All subscriptions`, `Specific Service Group(s)`, or
`All Service Groups`. Subscription and Service Group scopes are mutually exclusive.
Use one `ask_user` call for this choice; do not call Advisor recommendation tools before the
scope choice is answered.
When both subscription and Service Group scope are present, render the detected scope options
and their relevant access or truncation state before asking the user to choose one scope family.

Use the Azure MCP subscription listing once when subscription discovery is required. For Service Groups, call the dedicated Advisor `advisor_recommendation_service_group_scope` operation. It owns the
pre-authored Advisor Resource Graph query and returns a `results.serviceGroups` collection. Read
each entry's `serviceGroupId` (or a string value for older result shapes); do not treat an empty or
unrecognized field as zero groups. Do not substitute the generic ARM router, Azure CLI, or
generic resource inventory. Retain all returned IDs and preserve access errors and truncation.
When querying recommendations across multiple Service Groups, require
`where isnotempty(properties.serviceGroupId)` so only Service Group-associated records are
included. Deduplicate affected resources by stable recommendation identity plus impacted resource
ID across the selected Service Groups; retain Service Group IDs as membership metadata rather
than counting the same physical resource once per group.
For broad scope, hand off every resolved subscription ID or Service Group ID; never pass an empty
array or silently use the default subscription. The tool call is mandatory for dynamic scope
resolution; do not respond with sign-in instructions before attempting it.

After scope is resolved, every Advisor cost or idle-resource request loads
`azure-advisor-cost-optimization` and hands off the original request, including analysis,
savings, postpone, dismiss, deletion estimates, deletion preparation, scripts,
IaC, pipelines, and other remediation artifacts. The cost workflow owns the filtered Advisor
candidate set, recommendation-type selection, resource selection, and response contract. It
hands explicitly selected artifact requests to `azure-advisor-actionability`; do not invoke
actionability during scope resolution. Do not load `azure-cost`, Cost Management, pricing,
generic inventory, Azure CLI, or Resource Graph as a substitute for the Advisor cost workflow.

Read [Scope resolution](references/scope-resolution.md) for discovery, handoff, and error rules.
