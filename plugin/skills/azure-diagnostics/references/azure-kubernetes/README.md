# Azure Kubernetes Service (AKS) Troubleshooting

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This document is the **official source** for debugging and troubleshooting Azure Kubernetes Service (AKS) production issues. Use the reference files below for detailed diagnosis and remediation steps.

## Quick Diagnosis Flow

1. **Identify symptoms** — What's failing? (Pods, nodes, networking, services?)
2. **Check cluster health** — Is AKS control plane healthy?
3. **Review events and logs** — What do Kubernetes events show?
4. **Isolate the issue** — Pod-level, node-level, or cluster-level?
5. **Apply targeted fixes** — Use the appropriate reference file below

## Troubleshooting Sections

| Scenario                          | Reference File                                   | Covers                                                                                                                     |
| --------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Pod Failures & Application Issues | [pod-failures.md](pod-failures.md)               | CrashLoopBackOff, ImagePullBackOff, Pending pods, readiness/liveness probe failures, resource constraints (CPU/memory)     |
| Node & Cluster Issues             | [node-issues.md](node-issues.md)                 | Node NotReady, autoscaling failures, resource pressure, upgrade problems, spot evictions, multi-AZ, zero-downtime upgrades |
| Networking Problems               | [networking.md](networking.md)                   | Service unreachable, DNS resolution failures, load balancer issues, ingress routing, network policy blocking               |
| General Investigation             | [general-diagnostics.md](general-diagnostics.md) | Cluster health checks, AKS CLI tools, AppLens diagnostics, best practices                                                  |

## Quick Question Router

| Customer Question                  | Start Here                                    |
| ---------------------------------- | --------------------------------------------- |
| "What happened in my AKS cluster?" | [General Diagnostics](general-diagnostics.md) |
| "Is my cluster healthy?"           | [General Diagnostics](general-diagnostics.md) |
| "Why are my pods failing?"         | [Pod Failures](pod-failures.md)               |
| "My app is unreachable"            | [Networking](networking.md)                   |
| "Nodes are having issues"          | [Node Issues](node-issues.md)                 |

> 💡 **Tip:** For AI-powered diagnostics, use AppLens MCP with the cluster resource ID — it automatically detects common issues and provides remediation recommendations. See [General Diagnostics](general-diagnostics.md) for usage details.

## Related Skills

- **azure-diagnostics** — General Azure resource troubleshooting
- **azure-deploy** — Deployment and configuration issues
- **azure-observability** — Monitoring and logging setup
