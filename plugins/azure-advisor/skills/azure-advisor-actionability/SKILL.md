---
name: azure-advisor-actionability
description: "Remediate Azure Advisor recommendations. WHEN: \"fix Advisor recommendation\"."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Advisor Actionability

## Quick reference

Use `advisor_remediation_get` for one recommendation type and affected resource. Present remediation for the customer to run; never execute it without explicit confirmation.

Required context is the `recommendationTypeId` GUID and complete affected `resourceId`. Reuse known values; ask for missing values and never guess.

Get `resourceId` from the user's request or the exact affected-resource record selected from `advisor_recommendation_list`. If multiple resources match, ask the user to choose one; never substitute a recommendation instance ID.

## Workflow

1. Call `advisor_remediation_get` once with only `recommendationTypeId`.
2. For `RemediationNotFound`, state that remediation is unavailable. Report other errors without internals.
3. Use only returned steps, commands, parameters, verification, and safety information.
4. Resolve placeholders from `resourceId` or confirmed context: subscription, resource group, resource names, and full resource ID.
5. Replace only unambiguous placeholders; preserve and describe the rest.
6. Preserve step order. Separate Azure CLI and PowerShell when both exist.

For `guidance`, do not generate commands. For `hybrid` or `executable`, include every returned manual, decision, and command step. Include returned warnings and verification; omit raw JSON and internal labels.
