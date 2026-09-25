---
name: azure-search-nav
description: >-
  Builds an Azure portal deep link to a specific blade/menu item for supported
  Microsoft.ContainerService, Microsoft.Kubernetes, and Microsoft.Compute resources
  using the aks-search-direct-mid semantic search API.
  WHEN: "find where in the Azure portal to do something", "search the portal for an operation",
  "construct a portal link from a search query and a resource".
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Portal Search Link Builder

## Quick Reference

| Item | Value |
|------|-------|
| Script | `references/Invoke-PortalSearchNav.ps1` |
| Resource map | `references/resource-types.json` |
| Prerequisite | `Az.Accounts` PowerShell module |
| Auth | Interactive Microsoft sign-in (`Connect-AzAccount`) |

## When to Use This Skill

- User asks to find where in the Azure portal to perform an operation on a supported
  Container Service, Arc-enabled Kubernetes, or Compute resource.
- User wants a portal deep link for a specific blade/menu item.
- User provides a resource URL or ARM resource ID and a natural-language search query.

## Workflow

1. Collect **resource link** (portal URL or bare ARM resource ID) and **search query** from the user.
2. Run `references/Invoke-PortalSearchNav.ps1 -ResourceUrl '<link>' -Query '<query>'`.
3. The script signs in via the browser, calls the search API, and prints portal deep links.

See [references/README.md](references/README.md) for full parameter reference and API details.

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| Resource type not enabled | `armProvider` not in `references/resource-types.json` | Confirm the type is in the enabled-provider list |
| 401 from API | `App-Tenant-Id` header / token issuer mismatch | Script auto-resolves; verify correct account was selected |
| Empty results | No matching navigation item for the query | Try a different search term |
| `Az.Accounts` not found | Module not installed | `Install-Module Az.Accounts -Scope CurrentUser` |
