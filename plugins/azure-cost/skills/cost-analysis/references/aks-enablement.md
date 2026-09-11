# AKS Cost Analysis Enablement

Enable namespace-level cost visibility using the built-in AKS cost monitoring add-on.

## Check Status

Use `generate_query`, `validate_query`, then `execute_query` against AKS managed
clusters. Project the cluster name, resource group, SKU tier, and
`properties.metricsProfile.costAnalysis.enabled`. Follow any `skipToken`.

## Enable Add-on

This cost plugin does not bypass ARM MCP with CLI or direct REST mutations. If
the available ARM MCP tools do not expose AKS cost-analysis enablement, explain
the missing operation. Direct the user to the Azure Portal's AKS **Cost
Analysis** blade, or hand off to the `azure-kubernetes` skill when the separate
`azure@azure-skills` plugin is installed.

## If Cluster is Free Tier

Warn that upgrading from Free to Standard introduces an ongoing cluster
management fee. Use `get_retail_prices` to validate the current price and
obtain explicit approval before handing off the tier change.

## After Enabling

Namespace-level cost data is available in:
- Azure Portal: AKS cluster -> Cost Analysis blade
- Azure Cost Management: filter by cluster resource ID + `kubernetes namespace` dimension

> Risk: Low for enabling the add-on. Upgrading tier (Free -> Standard) has a cost — always confirm with user first.
