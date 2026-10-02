# Quality Gates & Decision Logic

## Pre-Finalization Verification

Before finalizing, verify every item:

### Checklist Coverage

- Every matrix item represented in the report
- Every row has ≥1 executed command or explicit `Not assessed` reason
- Every row has a concise `Comments` value and ≤5 remediation actions
- All references point to Microsoft Learn
- Scope and out-of-scope statements are explicit
- Subpage rollup includes every `Parent Page/Child Page` group
- AKS Checklist clashes resolved in favor of Microsoft Learn

### Diagnostics

- All 8 core detector categories queried and present
- Supplemental categories enumerated and assessed (or marked informational-only with rationale)
- Critical findings contradicting checklist status reconciled with justification
- Extraction timestamp recorded (UTC + local)

### Warning Events

- Section present and populated (or marked `Not assessed` with reason)
- Every Warning row includes resolved top-level workload (not Pod name) and 1-5 remediation steps
- Extraction timestamp recorded (UTC + local)
- Time window ≥30 days with Azure Monitor Logs; if etcd-only, limitation documented
- Probe deep-dive present for workloads meeting threshold (≥10 occurrences or ≥7 day span)
- Deep-dive references specific log patterns, probe config, dependency interactions

### Container Assessment

- Section present and populated (or marked `Not assessed` with reason)
- Summary statistics, category rollup, and detail table all present
- All `CTR-*` checks from container best practices reference covered
- System namespace findings reported separately; counting methodology stated
- Sidecar-inclusive and app-only percentages reported where material

### Validation Integrity

- Node image staleness checked; Critical if >90 days old
- Inline secrets (`CTR-CFG-01`) reports exact container count
- Next Steps uses time-boxed roadmap with CLI commands for Immediate items
- Commands Reference table present for audit reproducibility
- No check marked `Meets` when command failed/timed out/returned insufficient evidence

## Decision Logic

### Access Fallback Chain

| Scenario | Action |
|----------|--------|
| `az` unavailable | `kubectl` only; mark Azure checks `Not assessed` |
| `kubectl` unavailable | `az aks command invoke`; if also unavailable, mark Kubernetes checks `Not assessed` |
| MCP tools unavailable | `az rest` API calls; if both unavailable, mark Diagnostics `Not assessed` |
| `kubectl` unavailable for `CTR-*` | `az aks command invoke`; if unavailable, mark `CTR-*` `Not assessed` except `CTR-IMG-06`/`CTR-ACR-*` (via `az` CLI) |
| Insufficient permissions | Mark `Not assessed`; record exact missing permission |
| Not applicable to cluster | Set `Not applicable`; explain in Comments |

### Conservative Assessment

- Failed/timed-out/ambiguous → `Not assessed` (never infer `Meets` from absent evidence)
- Risk-acceptance judgments: state assumption in Comments; `Meets` only if evidence positively supports

### Service Mesh Interaction

When Linkerd/Istio detected, evaluate impact on probe failures, security context metrics, sidecar counts. Factor mesh-specific behaviors into probe deep-dive and container compliance scoring.

## Guardrails

- Do not request or output secrets (tokens, keys)
- Do not use other scripts; follow this skill's instructions and template only
- Do not use existing reports as sources
- Place temporary files in `<dirname(reportOutputPath)>/<clusterName> - <yyyymmddhhmm>/`
- Save temporary files in JSON format
