# Troubleshooting Overview

This subskill provides structured AKS troubleshooting using public Azure signals, AKS MCP tools, and safe kubectl guidance. Use AKS MCP as the default path whenever the task needs AKS-aware Azure inspection, kubectl access, built-in AppLens detectors, or advanced diagnostics such as Inspektor Gadget.

The attached product handler and prompt-flow scripts show a concrete pattern worth preserving in this skill:

- infer the cluster first
- parse whether the request is general, alert-driven, resource-state driven, event-driven, or live-metric driven
- run detector-backed troubleshooting first for broad or detector-friendly cases
- use specialized event or metrics inference when the input already has structured signals
- run a follow-up general synthesis only when the first pass returns incomplete diagnosis

## Operational Flow

| Stage                 | Product behavior to mirror in this skill                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Cluster resolution    | Infer or confirm the AKS cluster before running deeper diagnostics                               |
| Prompt parsing        | Distinguish free-form asks from structured alert, resource state, event, and live metric prompts |
| Detector-first branch | Use detector-backed diagnostics for general asks, alerts, and unhealthy resource state prompts   |
| Event branch          | Analyze Kubernetes warning events directly when event payloads are available                     |
| Metrics branch        | Analyze CPU or memory time series when live metric pressure data is provided                     |
| Follow-up branch      | If the specialized path is insufficient, run a broader general troubleshooting synthesis         |

## Quick Triage Lanes

| Lane                   | Common symptoms                                   | First focus                                                   |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| Control plane          | API server unavailable, auth or command failures  | Cluster health, control plane availability, recent changes    |
| Node health            | `NotReady` nodes, VMSS drift, node pressure       | Node pool state, VMSS health, kubelet signals                 |
| Workload runtime       | `Pending`, `CrashLoopBackOff`, `OOMKilled`        | Events, pod status, container logs, quotas                    |
| Image pull             | `ImagePullBackOff`, auth failures                 | Registry reachability, identity, image reference              |
| Networking and ingress | Service unreachable, DNS failures, ingress breaks | Service, endpoints, ingress controller, load balancer, egress |
| Identity and secrets   | Workload identity or Key Vault CSI failures       | Federated identity, managed identity, secret projection       |
| Storage                | PVC pending, mount errors, attach failures        | Storage class, PVC, disk, CSI state                           |
| Autoscaling            | HPA, KEDA, or node autoscaler not reacting        | Metrics pipeline, pending pods, node pool constraints         |
| Upgrades               | Failed upgrade or regression after upgrade        | Upgrade history, addon compatibility, node image state        |

## Signal Sources

| Source                         | When to use                                                                |
| ------------------------------ | -------------------------------------------------------------------------- |
| `mcp_azure_mcp_aks`            | Default entry point for AKS-aware Azure and kubectl diagnostics            |
| AKS MCP AppLens detectors      | When the configured AKS MCP server exposes detector-backed troubleshooting |
| AKS MCP Inspektor Gadget       | When low-level runtime or networking insight is needed and enabled         |
| `mcp_azure_mcp_monitor`        | Logs, metrics, and telemetry correlation                                   |
| `mcp_azure_mcp_resourcehealth` | Resource or regional health checks                                         |
| `mcp_azure_mcp_documentation`  | Microsoft Learn grounding for remediation and explanations                 |

## Input Normalization

The prompt-flow implementation normalizes several signal types before inference. Use the same mental model when authoring troubleshooting guidance:

| Input               | How to treat it                                                                   |
| ------------------- | --------------------------------------------------------------------------------- |
| Cluster info        | Keep cluster metadata available for context and resource mapping                  |
| Diagnostic insights | Preserve per-insight details for root-cause ranking and remediation extraction    |
| Problems list       | Reuse problem summaries when searching Learn or selecting detectors               |
| Kubernetes events   | Convert warning events into a compact tabular summary for direct event analysis   |
| Metrics             | Distinguish CPU from memory pressure and analyze time series anomalies separately |
| Resource symptoms   | Convert symptoms into concise resource-scoped entries for general troubleshooting |

## Scenario Matrix

| Symptom                   | Likely causes                                                 | Affected resources                                    | First checks                                            |
| ------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Pods stuck in `Pending`   | Insufficient CPU or memory, taints, affinity rules, PVC delay | Namespace, node pool, PVC                             | Pod events, scheduler messages, node capacity           |
| Pod in `CrashLoopBackOff` | App startup failure, bad config, secret missing               | Deployment, pod, secret source                        | Container logs, pod describe, recent rollout            |
| `ImagePullBackOff`        | Bad image path, missing auth, registry connectivity           | Registry, identity, image pull secret                 | Image reference, registry access, pod events            |
| Node `NotReady`           | VMSS issue, kubelet problem, resource pressure                | Node pool, VMSS, node                                 | Node conditions, node pool health, recent upgrades      |
| Ingress unreachable       | Controller issue, backend mismatch, LB or DNS problem         | Ingress controller, service, load balancer, public IP | Ingress status, service endpoints, load balancer health |
| Autoscaling not happening | Missing metrics, resource requests, scale limits              | HPA, KEDA scaler, node pool                           | Metrics availability, pending pods, scaler config       |

## Branching Rules

- No structured prompt data: start with detector-backed troubleshooting.
- Alert prompt: convert the alert into a concise issue statement and run detector-backed troubleshooting.
- Multiple alerts: address the highest-severity alert first, then continue through remaining alerts if the user wants deeper coverage.
- Unhealthy resource state prompt: combine resource-state messages into one detector-friendly prompt.
- Kubernetes events prompt: use event-specific inference instead of a generic detector pass.
- Live metrics prompt: scan the time series for anomalies first, then summarize pressure and remediation.
- Any branch returns incomplete diagnosis: run a broader general troubleshooting synthesis using the original prompt plus collected context.

## Affected Resource Mapping

- Pod scheduling failures usually map to the workload, namespace, node pool, and possibly storage.
- Image pull and registry failures usually map to the workload identity or secret plus the container registry.
- Ingress issues usually map to the ingress controller, service, load balancer, public IP, and DNS path.
- Node health issues usually map to the node pool, VMSS, and cluster upgrade or image state.

## Safe Command Patterns

Prefer AKS MCP for kubectl mediation. If the user needs manual commands, start with read-only patterns such as `kubectl get`, `kubectl describe`, `kubectl logs`, and event inspection before any mutation.

## Response Template

Use this structure in responses. Prefer the first shape for general, event, or metrics synthesis, and the second shape when detector insights are available.

General or specialized synthesis:

1. Symptom summary
2. Likely cause or top hypotheses
3. Affected resources
4. Evidence collected
5. Missing evidence
6. Next AKS MCP or kubectl checks
7. Remediation direction
8. Learn links

Detector-backed synthesis:

1. Insight name
2. Problem summary
3. Whether it is the likely root problem
4. Detailed description
5. Solution and remediation steps
6. Affected resources with issue type
7. kubectl commands extracted or recommended

For metrics-specific analysis, call out:

- healthy versus unhealthy status
- anomaly timestamps and descriptions
- suggestion for remediation or further investigation

## Future Integration Notes

The product direction may expand to richer multi-turn troubleshooting, action execution, and deeper telemetry fusion. This skill should describe only the capabilities available through public tooling and the configured AKS MCP server.
