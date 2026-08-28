---
name: aks-known-issues
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
description: "Match exact AKS operation-failure signatures to documented causes and fixes. WHEN: an AKS create, scale, upgrade, node-image, or image-pull failure names VMCannotFitEphemeralOSDisk, AKS-scoped LinkedAuthorizationFailed, NodePoolMcVersionIncompatible, 'NodeImageVersion is not accepted', SkuNotAvailable, ZonalAllocationFailed, OverconstrainedAllocationRequest, or an AKS vmssCSE/CSE nested signature: VMExtensionError_OutboundConnFail (exit 50), VMExtensionError_K8SAPIServerConnFail (exit 51), or VMExtensionError_K8SAPIServerDNSLookupFail (exit 52); also requests to explain a named AKS error, and AllocationFailed only when its nested message says internal error or insufficient capacity. DO NOT USE FOR: bare VMExtensionProvisioningError or AllocationFailed wrappers, or numeric exits without AKS vmssCSE/CSE context (use aks-troubleshooting); generic AKS incidents without a cataloged signature (use aks-troubleshooting); non-AKS LinkedAuthorizationFailed or Azure failures (use azure-diagnostics)."
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
