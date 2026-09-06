---
name: aks-known-issues
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
description: "Match only exact cataloged AKS operation failures to documented causes and fixes. WHEN: VMCannotFitEphemeralOSDisk; NodePoolMcVersionIncompatible; 'NodeImageVersion is not accepted'; AKS SkuNotAvailable, ZonalAllocationFailed, or OverconstrainedAllocationRequest with the cataloged placement qualifiers; nested AKS vmssCSE/CSE VMExtensionError_OutboundConnFail, VMExtensionError_K8SAPIServerConnFail, or VMExtensionError_K8SAPIServerDNSLookupFail; an authorization failure naming an AKS linked resource and action; or a node-pool allocation whose full nested message exactly identifies the cataloged internal-error or insufficient-regional-capacity cause. EXCLUDES: quota errors, bare wrappers, generic AKS symptoms, and incomplete signatures (use aks-troubleshooting); errors outside AKS (use azure-diagnostics)."
---

# AKS Known Issues

## Quick Reference

| Property | Value |
|---|---|
| Best for | Exact signature plus AKS operation |
| Output | Cause, fix, and Learn citation |

Use the [catalog](references/error-code-map.md).

## When to Use This Skill

Named catalog signatures only. Generic AKS → `aks-troubleshooting`; non-AKS →
no AKS skill.

If every qualifier for a catalog row is not present, do not use this skill.
This catalog has no quota-error rows; route AKS quota incidents to
`aks-troubleshooting`.

## MCP Tools

None required. Use advertised read-only Azure tools or CLI queries.

## Workflow

1. Capture exact code, nested message, operation, and AKS resource.
2. Require every qualifier; codes are not substrings.
3. Give cause, fix, citation, and read-only verification.
4. State what ran; require explicit approval before every mutation.

## Error Handling

| Input | Response |
|---|---|
| Bare wrapper/number | Request nested signature and CSE context |
| Generic AKS | `aks-troubleshooting` |
| Non-AKS | No AKS skill |
