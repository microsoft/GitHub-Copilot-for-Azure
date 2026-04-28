---
name: azure-kubernetes-review
license: MIT
metadata:
  author: johnbilliris
  version: "0.0.0-placeholder"
description: 'Assess an AKS cluster against Microsoft Learn practices and Azure Well-Architected AKS service guide. WHEN: "AKS practices review", "validate AKS posture", "AKS compliance checklist", "AKS remediation report".'
argument-hint: 'Provide subscription, resource group, AKS cluster name, and kube context.'
---

# Azure Kubernetes Service Review

Evidence-driven AKS assessment against [AKS best practices](https://learn.microsoft.com/en-us/azure/aks/best-practices), [Well-Architected AKS guide](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service), [AKS Checklist](https://www.the-aks-checklist.com/), live diagnostics detectors, and [container best practices](./references/aks-container-best-practices.md).

## When to Use

- Audit an AKS cluster against Well-Architected pillars
- Validate AKS operator and developer best-practice controls
- Produce command-backed pass/fail findings with remediation
- Generate a comprehensive Markdown compliance report

## Required Inputs

| Input | Required | Default |
|-------|----------|---------|
| `subscriptionId` | Yes | — |
| `resourceGroup` | Yes | — |
| `clusterName` | Yes | — |
| `kubeContext` | Yes | — |
| `reportOutputPath` | No | `./reports/azure kubernetes review - <clusterName> - <yyyymmddhhmm>.md` |
| `namespaceFilter` | No | all |
| `nodePoolFilter` | No | all |
| `excludeChecks` | No | none |

## Workflow

1. **Establish scope** — Confirm cluster identity, state in/out-of-scope, record limitations. See [Scope & Checklist](./references/workflow-scope-and-checklist.md).
2. **Load canonical checklist** — Use [AKS Checklist Matrix](./references/aks-checklist-matrix.md) with Microsoft Learn precedence. See [Scope & Checklist](./references/workflow-scope-and-checklist.md).
3. **Run diagnostics detectors** — Query 8 core + supplemental categories via AKS MCP or `az rest`. See [Diagnostics Workflow](./references/workflow-diagnostics.md).
4. **Collect warning events** — Gather Warning-type Kubernetes events per namespace, correlate to workloads, deep-dive probe failures. See [Warning Events Workflow](./references/workflow-warning-events.md).
5. **Run container assessment** — Execute all `CTR-*` checks. See [Container Assessment Workflow](./references/workflow-container-assessment.md).
6. **Run validation commands** — Execute `az`/`kubectl` checks, determine pass/fail per checklist item. See [Validation & Findings](./references/workflow-validation-and-findings.md).
7. **Produce detailed findings** — Build analysis tables, rollups, diagnostics impact, container results, warning events. See [Validation & Findings](./references/workflow-validation-and-findings.md).
8. **Generate report** — Fill [AKS Audit Report Template](./assets/aks-audit-report-template.md). See [Report Generation](./references/workflow-report.md).
9. **Quality gates** — Verify completeness. See [Quality Gates & Decision Logic](./references/quality-gates.md).

## Decision Logic

See [Quality Gates & Decision Logic](./references/quality-gates.md) for full rules. Key principles:

- If `az` unavailable → `kubectl` only, mark Azure checks `Not assessed`
- If `kubectl` unavailable → `az aks command invoke`, then `Not assessed`
- If MCP unavailable → `az rest`, then `Not assessed`
- Never infer `Meets` from absent evidence

## MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_aks` | AKS MCP entry point — discover callable AKS tools |

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| MCP tool fails/times out | Invalid credentials or context | Verify `az login`, confirm subscription with `az account show` |

## Output

One Markdown file at `reportOutputPath`: `Azure Kubernetes Service Review - <clusterName> - <yyyymmddhhmm>.md`

`reportOutputPath` is the full file path for the final Markdown report, not a directory.

## Guardrails

- Do not skip execution of any checklist, matrix, detector or workflow step. 
- ALL diagnostics detectors MUST be run to surface evidence and findings. Do not skip or cherry-pick based on expected outcomes. Do not skip even if they are expected to return no findings. Do not skip even if you think it would be inefficient.
- Do not request or output secrets (tokens, keys).
- Follow this skill's instructions and [template](./assets/aks-audit-report-template.md) only — no other scripts or existing reports
- Place temporary files in `<dirname(reportOutputPath)>/<clusterName> - <yyyymmddhhmm>/`

## References

- [AKS Checklist Matrix](./references/aks-checklist-matrix.md)
- [AKS Diagnostics Detectors](./references/aks-diagnostics-detectors.md)
- [AKS Container Best Practices](./references/aks-container-best-practices.md)
- [AKS Audit Report Template](./assets/aks-audit-report-template.md)
- [Scope & Checklist Workflow](./references/workflow-scope-and-checklist.md)
- [Diagnostics Workflow](./references/workflow-diagnostics.md)
- [Warning Events Workflow](./references/workflow-warning-events.md)
- [Container Assessment Workflow](./references/workflow-container-assessment.md)
- [Validation & Findings](./references/workflow-validation-and-findings.md)
- [Report Generation](./references/workflow-report.md)
- [Quality Gates & Decision Logic](./references/quality-gates.md)
