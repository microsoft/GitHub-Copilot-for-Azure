# AKS Cluster Review / Audit (Day-2)

Use this workflow when the user asks to **review**, **audit**, or **assess the compliance posture** of an existing AKS cluster (e.g. "review AKS", "audit AKS cluster", "AKS practices review", "validate AKS posture", "AKS compliance checklist", "AKS remediation report").

It produces an evidence-driven AKS assessment against [AKS best practices](https://learn.microsoft.com/en-us/azure/aks/best-practices), the [Well-Architected AKS service guide](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service), the [AKS Checklist](https://www.the-aks-checklist.com/), live diagnostics detectors, and [container best practices](./aks-container-best-practices.md), and emits a comprehensive Markdown audit report.

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

## Review Workflow

1. **Establish scope** — Confirm cluster identity, state in/out-of-scope, record limitations. See [Scope & Checklist](./aks-review-scope-and-checklist.md).
2. **Load canonical checklist** — Use the [AKS Checklist Matrix](./aks-checklist-matrix.md) with Microsoft Learn precedence. See [Scope & Checklist](./aks-review-scope-and-checklist.md).
3. **Run diagnostics detectors** — Query the 8 core + supplemental categories via AKS MCP or `az rest`. See [Diagnostics Workflow](./aks-review-diagnostics.md).
4. **Collect warning events** — Gather Warning-type Kubernetes events per namespace, correlate to workloads, deep-dive probe failures. See [Warning Events Workflow](./aks-review-warning-events.md).
5. **Run container assessment** — Execute all `CTR-*` checks. See [Container Assessment Workflow](./aks-review-container-assessment.md).
6. **Run validation commands** — Execute `az` / `kubectl` checks, determine pass/fail per checklist item. See [Validation & Findings](./aks-review-validation-and-findings.md).
7. **Produce detailed findings** — Build analysis tables, rollups, diagnostics impact, container results, warning events. See [Validation & Findings](./aks-review-validation-and-findings.md).
8. **Generate report** — Fill the [AKS Audit Report Template](../assets/aks-audit-report-template.md). See [Report Generation](./aks-review-report.md).
9. **Quality gates** — Verify completeness. See [Quality Gates & Decision Logic](./aks-review-quality-gates.md).

## Review Decision Logic

See [Quality Gates & Decision Logic](./aks-review-quality-gates.md) for full rules. Key principles:

- If `az` unavailable → `kubectl` only, mark Azure checks `Not assessed`
- If `kubectl` unavailable → `az aks command invoke`, then `Not assessed`
- If MCP unavailable → `az rest`, then `Not assessed`
- Never infer `Meets` from absent evidence

## Review Output

One Markdown file at `reportOutputPath`: `Azure Kubernetes Service Review - <clusterName> - <yyyymmddhhmm>.md`. `reportOutputPath` is the full file path for the final Markdown report, not a directory.

## Review Guardrails

- Do not skip execution of any checklist, matrix, detector or workflow step.
- ALL diagnostics detectors MUST be run to surface evidence and findings. Do not skip or cherry-pick based on expected outcomes, even if they are expected to return no findings, even if you think it would be inefficient.
- Do not request or output secrets (tokens, keys).
- Follow this skill's instructions and [template](../assets/aks-audit-report-template.md) only — no other scripts or existing reports.
- Place temporary files in `<dirname(reportOutputPath)>/<clusterName> - <yyyymmddhhmm>/`.

## Review References

- [AKS Checklist Matrix](./aks-checklist-matrix.md)
- [AKS Diagnostics Detectors](./aks-diagnostics-detectors.md)
- [AKS Container Best Practices](./aks-container-best-practices.md)
- [AKS Audit Report Template](../assets/aks-audit-report-template.md)
- [Scope & Checklist Workflow](./aks-review-scope-and-checklist.md)
- [Diagnostics Workflow](./aks-review-diagnostics.md)
- [Warning Events Workflow](./aks-review-warning-events.md)
- [Container Assessment Workflow](./aks-review-container-assessment.md)
- [Validation & Findings](./aks-review-validation-and-findings.md)
- [Report Generation](./aks-review-report.md)
- [Quality Gates & Decision Logic](./aks-review-quality-gates.md)
