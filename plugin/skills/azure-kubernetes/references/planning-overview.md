# Planning Overview for AKS

Use this reference when the user is designing or provisioning AKS rather than debugging an existing incident.

## Day-0 decisions

- **Cluster type**: default to AKS Automatic. Use Standard when the user needs custom networking, autoscaling, node pools, or deeper operational control.
- **Networking**: choose API server access, Azure CNI Overlay versus VNet-routable pod IPs, ingress path, egress control, and DNS strategy up front.
- **Availability**: plan for zones, region choice, and control plane resiliency early.

## Day-1 configuration

- **Identity and secrets**: prefer Microsoft Entra ID, workload identity or managed identity, and Key Vault CSI.
- **Governance**: enable Azure Policy and deployment safeguards where appropriate.
- **Observability**: use Azure Monitor, Container Insights, Prometheus, and Grafana for cluster visibility.
- **Upgrades**: define maintenance windows, upgrade cadence, and patching expectations.

## Reliability, scale, and cost

- Use dedicated system capacity, sensible node sizes, topology spread, and PodDisruptionBudgets for production.
- Use autoscaling features such as cluster autoscaler or KEDA when they fit the workload.
- Consider Spot pools, stop or start patterns for dev or test, and reserved capacity or savings plans for steady workloads.

## AKS MCP usage

When planning requires AKS-aware Azure inspection or kubectl-aware reasoning, prefer the AKS MCP server over ad hoc shell commands.

See [CLI reference](./cli-reference.md) for concrete commands.