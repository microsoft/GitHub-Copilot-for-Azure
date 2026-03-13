---
name: troubleshooting
description: "Troubleshoot Azure Kubernetes Service (AKS) clusters using structured triage for control plane, nodes, workloads, networking, ingress, scaling, upgrades, and observability. WHEN: AKS cluster down, pod pending, crashloop, node not ready, image pull failure, ingress issue, autoscaler issue, upgrade failure, kubectl troubleshooting."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.2"
---

# AKS Troubleshooting

## Quick Reference

| Property             | Value                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Best for             | Day-2 diagnosis of AKS cluster, node, workload, networking, and upgrade issues                                                                                                     |
| MCP Tools            | Azure/aks-mcp integrations such as `mcp_azure_mcp_aks`, `mcp_aks_mcp_az_aks_operations`, plus `mcp_azure_mcp_monitor`, `mcp_azure_mcp_resourcehealth`, and `mcp_azure_mcp_documentation` |
| AKS MCP capabilities | Azure/aks-mcp exposes AKS-aware Azure APIs, kubectl mediation, detectors, fleet/network/compute views, and advanced troubleshooting such as Inspektor Gadget when enabled        |
| Detailed guidance    | [references/troubleshooting-overview.md](references/troubleshooting-overview.md), [references/aks-mcp.md](references/aks-mcp.md)                                                 |

## When to Use This Skill

- AKS cluster or API server is unavailable
- Node pool is unhealthy or nodes are `NotReady`
- Pods are stuck in `Pending`, `CrashLoopBackOff`, `OOMKilled`, or restarting repeatedly
- Workloads hit `ImagePullBackOff` or registry authentication failures
- Service, ingress, DNS, CNI, egress, or network policy traffic is failing
- Workload identity, managed identity, Key Vault CSI, or other auth flows are broken
- PVC, disk attach, storage class, or mount issues block workloads
- HPA, KEDA, cluster autoscaler, or node auto provisioning is not scaling as expected
- AKS upgrade or post-upgrade regressions need diagnosis
- The user wants kubectl-based troubleshooting guidance or AKS detector-backed investigation

## MCP Tools

| Tool                            | Command or Role | Use                                                                                                                   |
| ------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Azure/aks-mcp`                 | External server | Preferred AKS-aware MCP server. Depending on the client, this may surface as unified `call_az` / `call_kubectl` tools or mapped legacy AKS tools |
| `mcp_azure_mcp_aks`             | AKS MCP server  | Primary repo/client-mapped entry point for AKS-aware Azure inspection, kubectl mediation, and advanced diagnostics   |
| `mcp_aks_mcp_az_aks_operations` | AKS operations  | Cluster and node pool operations exposed through AKS MCP                                                              |
| `mcp_azure_mcp_monitor`         | `logs_query`    | Query Azure Monitor logs and metrics when cluster telemetry is involved                                               |
| `mcp_azure_mcp_resourcehealth`  | `get`           | Check health state of the AKS resource and supporting Azure resources                                                 |
| `mcp_azure_mcp_documentation`   | Doc search      | Pull Microsoft Learn guidance for the exact failure mode                                                              |

When kubectl commands, AppLens detectors, Inspektor Gadget, fleet, or AKS-aware Azure inspection are needed, prefer Azure/aks-mcp rather than direct terminal commands. In this repo's client integrations, those capabilities may appear under mapped names such as `mcp_azure_mcp_aks`, `mcp_aks_mcp_az_aks_operations`, kubectl tools, detector tools, or Inspektor Gadget. See [references/aks-mcp.md](references/aks-mcp.md) for installation and configuration guidance.

## Workflow

1. Resolve cluster context first.
   Infer or confirm the AKS cluster before deeper troubleshooting. If the cluster cannot be determined, ask for the minimum cluster identifier needed to continue.

2. Parse whether the prompt is free-form or structured.
   Treat the request as one of these shapes when possible: general troubleshooting prompt, alert-driven prompt, unhealthy resource state prompt, Kubernetes warning event prompt, or live metric pressure prompt.

3. Use the detector-first path for generic, alert, and resource-state cases.
   For a plain troubleshooting ask, start with AKS MCP detector-style diagnostics. For alerts or unhealthy resource states, convert the structured signal into a troubleshooting prompt and run the detector-backed path first.

4. Use specialized branches for events and metrics.
   If the input is warning events, analyze the events directly. If the input is live CPU or memory pressure data, analyze the metric trend first, then summarize whether the resource is healthy and what to investigate next.

5. Normalize inputs before inference.
   Gather the cluster metadata, detector insights, problem list, warning events, metric time series, and resource symptoms into a consistent structure before summarization. This mirrors the product flow, which formats events and symptoms into compact table-like inputs for downstream analysis.

6. Produce structured outputs.
   Prefer outputs that separate summary, likely cause, solution, monitoring strategy, affected resources, and kubectl commands. For detector-backed results, identify which insight is the likely root problem and preserve the per-insight remediation steps.

7. Run a follow-up general pass when the first pass is incomplete.
   If the detector, event, or metrics path cannot finish the diagnosis cleanly, fall back to a broader general troubleshooting synthesis using the same prompt plus any structured context already collected.

8. End with safe next steps and Learn grounding.
   Prefer read-only kubectl guidance first, keep disruptive actions explicit, and attach the most relevant Learn links or Azure surfaces to inspect next.

## Error Handling

| Error or blocker                                | Likely cause                                                         | Remediation                                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| No AKS cluster context                          | Cluster name, resource group, or subscription is missing             | Ask for the minimum cluster identifier needed to continue                                                        |
| AKS MCP server is unavailable                   | Azure/aks-mcp is not installed, started, or exposed by the client    | Install or start Azure/aks-mcp, then retry with MCP tools before falling back to manual CLI guidance            |
| AKS MCP cannot access the cluster               | Azure auth, RBAC, namespace restrictions, or MCP configuration issue | Confirm AKS MCP authentication and permissions, then fall back to manual commands only if needed                 |
| kubectl diagnostics require elevated access     | Server is running readonly or restricted namespaces only             | Tell the user which AKS MCP access level or namespace scope is blocking the step                                 |
| Logs or metrics are missing                     | Monitoring not enabled or wrong workspace queried                    | Confirm monitoring setup and shift to Kubernetes events and resource state                                       |
| Structured prompt data is invalid or incomplete | Alert, event, metric, or nudge payload could not be parsed cleanly   | Fall back to a plain detector-backed troubleshooting prompt instead of blocking outright                         |
| Multiple alerts or issues are present           | More than one alert or problem needs diagnosis                       | Triage the highest-severity or most actionable issue first, then continue through the remaining alerts if needed |
| Symptom is too generic                          | User asked for broad troubleshooting without a failure signal        | Ask one targeted follow-up question about symptom, scope, or timing                                              |

## Guardrails

- Treat AKS MCP as the preferred execution surface for AKS-aware Azure and kubectl operations.
- Do not claim private internal backends are available unless exposed through AKS MCP or other public tools.
- Do not execute disruptive remediation steps without clear user confirmation.
- Do not request or expose secrets, kubeconfigs, tokens, or subscription IDs in the response.

See [references/troubleshooting-overview.md](references/troubleshooting-overview.md) for scenario-based guidance.
