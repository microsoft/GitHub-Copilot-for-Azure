---
name: aks-known-issues
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
description: "Use only for an exact, fully qualified AKS operation-failure signature from this catalog. MATCHES: VMCannotFitEphemeralOSDisk; NodePoolMcVersionIncompatible; 'NodeImageVersion is not accepted'; SkuNotAvailable naming AKS placement; ZonalAllocationFailed or OverconstrainedAllocationRequest with documented qualifiers; nested AKS vmssCSE/CSE signatures VMExtensionError_OutboundConnFail, VMExtensionError_K8SAPIServerConnFail, or VMExtensionError_K8SAPIServerDNSLookupFail; an authorization failure explicitly naming an AKS linked resource and action; or a node-pool allocation whose full nested message states 'The VM allocation failed due to an internal error' or 'We do not have sufficient capacity for the requested VM size in this region.' Every AKS, operation, and nested-message qualifier must be present. Route incomplete or uncataloged AKS failures to aks-troubleshooting and non-AKS Azure failures to azure-diagnostics."
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
