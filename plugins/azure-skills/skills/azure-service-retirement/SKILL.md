---
name: azure-service-retirement
description: "Find Azure Advisor retirement deadlines and affected resources. WHEN: Azure service, SKU, runtime, API, feature, or version retirement, deprecation, shutdown, end of support, end of life; AKS or Kubernetes version support ending; Service Health retirement ID; retirement-required migration. DO NOT USE FOR: upgrades, patching, modernization, migrations, or Advisor requests without explicit retirement lifecycle context."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Service Retirement

Use only for explicit Azure retirement lifecycle events. Upgrades and migrations are in scope only as retirement remediation.

## Quick Reference

| Property | Value |
|---|---|
| MCP tool | `advisor_recommendation_list` |
| Required | `subscription` |
| Optional filters | `subCategory`, `trackingIds`, `retirementDate` |

## Workflow

1. Infer `subscription` only from established context; otherwise ask for it.
2. Read and follow [Retirement Query Rules](references/query-rules.md).
3. Call `advisor_recommendation_list` with only justified, non-empty filters.
4. Report only returned data; prioritize expired and nearest deadlines. Never invent findings.
5. For no results, say no matching **active Advisor retirement recommendations** were found for the supplied scope and filters, not that no Azure retirement exists.
6. If `areResultsTruncated` is true, identify results as partial.

Do not handle routine updates, modernization, unrelated migrations, general Advisor requests, or upgrade-only prompts. Advisor results are authoritative; never infer unsupported status.