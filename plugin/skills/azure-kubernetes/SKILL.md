---
name: azure-kubernetes
description: "Plan and create production-ready Azure Kubernetes Service (AKS) clusters. Covers Day-0 decisions (networking, API server access, pod IP model), Day-1 configuration (identity, secrets, governance, observability), cluster SKUs (Automatic vs Standard), workload identity, Key Vault CSI, Azure Policy, deployment safeguards, monitoring with Prometheus/Grafana, upgrade strategies, and cost analysis. USE FOR: create AKS cluster, AKS cluster planning, AKS networking design, security design, upgrade settings, autoscaling, AKS monitoring, AKS cost analysis, AKS production best practices, AKS Automatic vs Standard, AKS add-ons. DO NOT USE FOR: debugging AKS issues (use azure-diagnostics), deploying applications to AKS (use azure-deploy), creating other Azure resources (use azure-prepare), setting up general monitoring (use azure-observability), general cost optimization strategies (use azure-cost-optimization)."
---

# Azure Kubernetes Service

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This skill produces a **recommended AKS cluster configuration** based on user requirements, distinguishing **Day-0 decisions** (networking, API server — hard to change later) from **Day-1 features** (can enable post-creation). See [CLI reference](./references/cli-reference.md) for commands.

## Triggers
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

## Rules
1. Start with the user's requirements for provisioning compute, networking, security, and other settings.
2. Use the AKS MCP server for invoking Azure API and kubectl commands when applicable during the cluster setup and operations processes.
3. Determine if AKS Automatic or Standard SKU is more appropriate based on the user's need for control vs convenience. Default to AKS Automatic unless specific customizations are required.
4. Document decisions and rationale for cluster configuration choices, especially for Day-0 decisions that are hard to change later (networking, API server access).


## Required Inputs (Ask only what’s needed)
If the user is unsure, use safe defaults.
- Cluster environment: dev/test or production
- Region(s), availability zones, preferred node VM sizes
- Expected scale (node/cluster count, workload size)
- Networking requirements (API server access, pod IP model, ingress/egress control)
- Security and identity requirements, including image registry
- Upgrade and observability preferences
- Cost constraints

## Key Decisions (Defaults when user is unsure)

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