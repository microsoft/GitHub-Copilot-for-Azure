# AKS Skills

AKS-focused operational skills maintained as a budget-isolated sibling plugin.

## Skills

- **aks-gpu-inference** - Diagnose existing AKS GPU and KAITO inference incidents with profile-aware, read-only evidence.
- **aks-known-issues** - Match named AKS failure signatures to documented causes, fixes, and Microsoft Learn references.
- **aks-network-capture** - Collect bounded packet captures from selected AKS nodes and gather Azure network configuration for wire-level troubleshooting.
- **aks-troubleshooting** - Investigate live AKS incidents with target-bound, read-only evidence collection and structured root-cause reporting.

The skills were migrated from `Azure/AKS-Skills` PR #99 at commit
`5f7d3910b30a93d49e3f0f657ac478ca01b7c870`. The troubleshooting
public-canary evals trace to PR #102 source commit
`6c17c636e9b11fa44b82e026edc14226f9f197cb`.

## Authoring rules

- Separate observed evidence from inference; causal branches are hypotheses
  until target-bound evidence supports one.
- State applicability for profile-, platform-, and feature-specific guidance.
- Keep mutation approvals in the entry workflow, before commands or resources.
- Preserve missing or inaccessible data as unknown; never convert it to absence.
- Use public first-party sources for factual guidance and keep examples distinct
  from required customer evidence.