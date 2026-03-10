---
name: azure-kubernetes
license: MIT
metadata:
  author: Microsoft
  version: "1.0.1"
description: "Plan and create production-ready Azure Kubernetes Service (AKS) clusters. Covers Day-0 decisions and Day-1 configuration, cluster SKUs (Automatic vs Standard), security, monitoring, reliability/performance best practices, upgrades, and networking. WHEN: create AKS cluster, plan AKS configuration, design AKS networking, AKS Automatic vs Standard, AKS security, AKS upgrade strategy, AKS autoscaling, AKS monitoring setup, AKS cost analysis, Day-0 checklist."
---

# Azure Kubernetes Service

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This parent skill is the **AKS entry point**. Route active AKS issues to [AKS Troubleshooting](./troubleshooting/SKILL.md). Keep this file focused on **planning and production-ready cluster configuration**, distinguishing **Day-0 decisions** (networking, API server — hard to change later) from **Day-1 features** (can enable post-creation). See [CLI reference](./references/cli-reference.md) for commands.

## Quick Reference
| Property | Value |
|----------|-------|
| Best for | AKS entry-point routing plus cluster planning and Day-0 decisions |
| MCP Tools | `mcp_azure_mcp_aks`, `mcp_aks_mcp_az_aks_operations` |
| CLI | `az aks create`, `az aks show` |
| Related skills | [AKS Troubleshooting](./troubleshooting/SKILL.md), azure-diagnostics, azure-deploy |

## When to Use This Skill
Activate this skill when user wants to:
- Create a new AKS cluster
- Plan AKS cluster configuration for production workloads
- Design AKS networking (API server access, pod IP model, egress)
- Set up AKS identity and secrets management
- Configure AKS governance (Azure Policy, Deployment Safeguards)
- Enable AKS observability (monitoring, Prometheus, Grafana)
- Define AKS upgrade and patching strategy
- Enable AKS cost visibility and analysis
- Understand AKS Automatic vs Standard SKU differences
- Get a Day-0 checklist for AKS cluster setup and configuration
- Route an AKS troubleshooting question to the correct subskill

## Routing

Use this parent skill as the AKS entry point and route by user intent:

- **Planning / Day-0 / Day-1**: cluster creation, networking design, security posture, observability setup, upgrades, and cost or reliability decisions
- **Troubleshooting / Day-2**: existing cluster issues, pod failures, node health problems, ingress or networking breaks, autoscaling failures, image pull issues, or requests for diagnostic kubectl guidance

If the user is diagnosing an active AKS problem, use [AKS Troubleshooting](./troubleshooting/SKILL.md).
If the user is designing or provisioning AKS, stay in this parent skill.

## Sub-Skills

| Sub-skill | When to route |
|-----------|---------------|
| [AKS Troubleshooting](./troubleshooting/SKILL.md) | Day-2 AKS diagnosis and remediation guidance |

## Rules
1. Start with the user's requirements for provisioning compute, networking, security, and other settings.
2. Use the AKS MCP server for AKS Azure API access and kubectl operations when applicable during setup and operations.
3. Determine if AKS Automatic or Standard SKU is more appropriate based on the user's need for control vs convenience. Default to AKS Automatic unless specific customizations are required.
4. Document decisions and rationale for cluster configuration choices, especially for Day-0 decisions that are hard to change later (networking, API server access).

## MCP Tools

| Tool | Use |
|------|-----|
| `mcp_azure_mcp_aks` | Primary AKS MCP server for cluster facts, Azure resource inspection, and AKS-aware operations |
| `mcp_aks_mcp_az_aks_operations` | AKS MCP Azure operations for cluster and node pool management flows |

When a request requires AKS-aware Azure inspection, kubectl commands, AppLens detectors, or Inspektor Gadget, prefer the AKS MCP server over direct shell commands.


## Required Inputs (Ask only what’s needed)
If the user is unsure, use safe defaults.
- Cluster environment: dev/test or production
- Region(s), availability zones, preferred node VM sizes
- Expected scale (node/cluster count, workload size)
- Networking requirements (API server access, pod IP model, ingress/egress control)
- Security and identity requirements, including image registry
- Upgrade and observability preferences
- Cost constraints

## Workflow

### 1. Cluster Type
- **AKS Automatic** (default): Best for most production workloads, provides a curated experience with pre-configured best practices for security, reliability, and performance. Use unless you have specific custom requirements for networking, autoscaling, or node pool configurations not supported by NAP.
- **AKS Standard**: Use if you need full control over cluster configuration, will require additional overhead to setup and manage.

### 2. Networking (Pod IP, Egress, Ingress, Dataplane)

**Pod IP Model** (Key Day-0 decision):
- **Azure CNI Overlay** (recommended): pod IPs from private overlay range, not VNet-routable, scales to large clusters and good for most workloads
- **Azure CNI (VNet-routable)**: pod IPs directly from VNet (pod subnet or node subnet), use when pods must be directly addressable from VNet or on-prem
  - Docs: https://learn.microsoft.com/azure/aks/azure-cni-overlay

**Dataplane & Network Policy**:
- **Azure CNI powered by Cilium** (recommended): eBPF-based for high-performance packet processing, network policies, and observability

**Egress**:
- **Static Egress Gateway** for stable, predictable outbound IPs
- For restricted egress: UDR + Azure Firewall or NVA

**Ingress**:
- **App Routing addon with Gateway API** — recommended default for HTTP/HTTPS workloads
- **Istio service mesh with Gateway API** — for advanced traffic management, mTLS, canary deployments
- **Application Gateway for Containers** — for L7 load balancing with WAF integration

**DNS**:
- Enable **LocalDNS** on all node pools for reliable, performant DNS resolution

### 3. Security
- Use **Microsoft Entra ID** everywhere (control plane, Workload Identity for pods, node access). Avoid static credentials.
- Azure Key Vault via **Secrets Store CSI Driver** for secrets
- Enable **Azure Policy** + **Deployment Safeguards**
- Enable **Encryption at rest** for etcd/API server; **in-transit** for node-to-node
- Allow only signed, policy-approved images (Azure Policy + Ratify), prefer **Azure Container Registry**
- **Isolation**: Use namespaces, network policies, scoped logging

### 4. Observability
- Use Azure Monitor and Container Insights for AKS monitoring enablement (logs + Prometheus + Grafana).

### 5. Upgrades & Patching
- Configure **Maintenance Windows** for controlled upgrade timing
- Enable **auto-upgrades** for cluster and node OS to stay up-to-date with security patches and Kubernetes versions
- Consider **LTS versions** for enterprise stability (2-year support) by upgrading your cluster to the AKS Premium tier
- **Multi-cluster upgrades**: Use **AKS Fleet Manager** for staged rollout across test → production clusters

### 6. Performance
- Use **Ephemeral OS disks** (`--node-osdisk-type Ephemeral`) for faster node startup
- Select **Azure Linux** as node OS (smaller footprint, faster boot)
- Enable **KEDA** for event-driven autoscaling beyond HPA

### 7. Node Pools & Compute
- **Dedicated system node pool**: At least 2 nodes, tainted for system workloads only (`CriticalAddonsOnly`)
- Enable **Node Auto Provisioning (NAP)** on all pools for cost savings and responsive scaling
- Use **latest generation SKUs (v5/v6)** for host-level optimizations
- **Avoid B-series VMs** — burstable SKUs cause performance/reliability issues
- Use SKUs with **at least 4 vCPUs** for production workloads
- Set **topology spread constraints** to distribute pods across hosts/zones per SLO

### 8. Reliability
- Deploy across **3 Availability Zones** (`--zones 1 2 3`)
- Use **Standard tier** for zone-redundant control plane + 99.95% SLA for API server availability
- Enable **Microsoft Defender for Containers** for runtime protection
- Configure **PodDisruptionBudgets** for all production workloads
- Use **topology spread constraints** to ensure pod distribution across failure domains

### 9. Cost Controls
- Use **Spot node pools** for batch/interruptible workloads (up to 90% savings)
- **Stop/Start** dev/test clusters: `az aks stop/start`
- Consider **Reserved Instances** or **Savings Plans** for steady-state workloads

## Guardrails / Safety
- Do not request or output secrets (tokens, keys, subscription IDs).
- If requirements are ambiguous for day-0 critical decisions, ask the user clarifying questions. For day-1 enabled features, propose 2–3 safe options with tradeoffs and choose a conservative default.
- Do not promise zero downtime; advise workload safeguards (PDBs, probes, replicas) and staged upgrades along with best practices for reliability and performance.
- If user asks for actions that require privileged access, provide a plan and commands with placeholders.