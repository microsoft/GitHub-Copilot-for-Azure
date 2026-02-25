---
name: azure-kubernetes
description: >-
  Plan and create production-ready Azure Kubernetes Service (AKS) clusters. Covers Day-0 decisions (networking, API server access, pod IP model), Day-1 configuration (identity, secrets, governance, observability), cluster SKUs (Automatic vs Standard), workload identity, Key Vault CSI, Azure Policy, deployment safeguards, monitoring with Prometheus/Grafana, upgrade strategies, and cost analysis.
  USE FOR: create AKS cluster, AKS cluster planning, AKS networking design, security design, upgrade settings, autoscaling, AKS monitoring, AKS cost analysis, AKS production best practices, AKS Automatic vs Standard, AKS add-ons
  DO NOT USE FOR: debugging AKS issues (use azure-diagnostics), deploying applications to AKS (use azure-deploy), creating other Azure resources (use azure-prepare), setting up general monitoring (use azure-observability), general cost optimization strategies (use azure-cost-optimization)
---

# Azure Kubernetes Service

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This document is the **official source** for setting up best practice Azure Kubernetes Service clusters. Follow these instructions to create and configure AKS clusters that are aligned with the user's requirements.

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

---

## Overview
This skill guides a user through planning and creating an Azure Kubernetes Service (AKS) cluster using public best practices for:
- cluster mode selection (Automatic vs Standard),
- networking (API server access, egress, pod IP model),
- identity (Microsoft Entra + Workload Identity),
- secrets management (Key Vault CSI),
- governance (Azure Policy + Deployment Safeguards),
- observability (Azure Monitor, Managed Prometheus, Managed Grafana),
- upgrades/patching (auto-upgrade channels, maintenance windows),
- cost visibility (AKS Cost Analysis).

References are public and included at the end.

---

## When to Use
Use this skill when a user asks:
- “What do I need to decide before creating AKS?”
- “Create an AKS cluster plan/design for production”
- “AKS networking: overlay vs pod subnet vs node subnet”
- “How do I set up Workload Identity / Key Vault CSI / Azure Policy?”
- “How do I configure upgrades, patching, and observability on AKS?”

---

## Goals / Outcomes
1. Produce a **recommended AKS cluster configuration** based on user requirements (security, scale, connectivity, compliance).
2. Provide a **Day-0 checklist** (decisions that are hard to change later, like networking and API server exposure).
3. Provide a **Day-1 checklist** (baseline add-ons and settings for production readiness).
4. Optionally output a **command/IaC skeleton** (placeholders only unless user provides values).

---

## Required Inputs (Ask only what’s needed)
If the user is unsure, use safe defaults.

### A) Environment & scale
- Environment: `dev/test` or `production`
- Region(s) + availability zones needed?
- Expected scale: node count / cluster count (single vs multi)

### B) Networking requirements (Day-0 critical)
- API server access:
  - Public API server or Private cluster?
- Pod IP model:
  - Do pods need **direct routable IPs in the VNet**?
- Egress control:
  - Default outbound, NAT Gateway, or UDR + firewall/NVA?

### C) Identity & security posture
- Microsoft Entra RBAC required?
- Need pod-to-Azure access with **Workload Identity**?
- Regulated environment needs (private cluster, policy enforcement, restricted egress)?

---

## Outputs (What the Skill Produces)
### Primary Output: “AKS Setup Plan”
1. Cluster type recommendation (Automatic vs Standard)
2. Networking plan (control plane access, egress choice, pod IP model)
3. Node pools + scaling plan
4. Security baseline (identity, secrets, policy)
5. Observability baseline (metrics/logs/dashboards/alerts)
6. Upgrade & patching plan
7. Cost controls baseline
8. Day-0 checklist + Day-1 checklist

### Optional Outputs
- CLI skeleton (placeholders)
- IaC outline (Bicep/Terraform module list)

---

## Decision Framework (Defaults when user is unsure)

### 1) Cluster Type
- Prefer **AKS Automatic** when you want a production-oriented, opinionated setup with many best practices preconfigured.
- Prefer **AKS Standard** when you need maximum control and customizations.
Docs: AKS Automatic overview: https://learn.microsoft.com/azure/aks/intro-aks-automatic

### 2) Pod Networking Model (Key Day-0 decision)
- Prefer **Azure CNI Overlay** for scalability and conserving VNet IP space.
Docs: https://learn.microsoft.com/azure/aks/azure-cni-overlay

If pods must be directly addressable/routable in your VNet, use VNet-based Azure CNI options:
- Azure CNI with pod subnet or node subnet models (see Azure CNI overlay + related networking docs)

### 3) Dataplane / Network Policy
- Consider **Azure CNI powered by Cilium** for eBPF-based performance and policy/observability features.
Docs: https://learn.microsoft.com/azure/aks/azure-cni-powered-by-cilium

### 4) Workload Identity (Preferred for pod-to-Azure auth)
- Prefer **Microsoft Entra Workload ID** for workloads calling Azure services without secrets.
Docs: https://learn.microsoft.com/azure/aks/workload-identity-overview

### 5) Secrets
- Prefer Azure Key Vault via **Secrets Store CSI Driver** provider.
Docs: https://learn.microsoft.com/azure/aks/csi-secrets-store-driver

### 6) Governance
- Enable **Azure Policy** (prereq) and **Deployment Safeguards** for workload best-practice enforcement.
Docs: Deployment Safeguards: https://learn.microsoft.com/azure/aks/deployment-safeguards

### 7) Observability
- Use Azure Monitor for AKS monitoring enablement (logs + Prometheus + Grafana).
Docs: https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable  
Prometheus overview: https://learn.microsoft.com/azure/azure-monitor/metrics/prometheus-metrics-overview

### 8) Upgrades & Patching
- Establish an upgrade strategy and ensure workloads are upgrade-safe (PDBs, probes, etc.).
Docs: AKS patch/upgrade guidance: https://learn.microsoft.com/azure/architecture/operator-guides/aks/aks-upgrade-practices

For node OS patching:
- Node OS auto-upgrade channels: https://learn.microsoft.com/azure/aks/auto-upgrade-node-os-image  
For cluster version auto-upgrades:
- Cluster auto-upgrade channels: https://learn.microsoft.com/azure/aks/auto-upgrade-cluster

---

## Step-by-Step Execution (Agent Behavior)

### Step 1 — Classify scenario
Identify environment, compliance posture, region/AZ needs, scale, and workload types.

### Step 2 — Recommend cluster type
Recommend AKS Automatic or Standard with short rationale.
- AKS Automatic intro: https://learn.microsoft.com/azure/aks/intro-aks-automatic

### Step 3 — Lock networking (Day-0)
Ask:
- Public vs Private API server?
- Pod IP model: overlay vs VNet-routable requirement?
- Egress: LB vs NAT Gateway vs UDR+Firewall?

Reference: Azure CNI Overlay setup: https://learn.microsoft.com/azure/aks/azure-cni-overlay

### Step 4 — Node pools and compute
Recommend:
- system node pool + user node pools
- separate pools for GPU/batch/stateful if applicable
- capacity planning considerations (max pods per node affects IP planning, upgrades)

### Step 5 — Configure autoscaling
Recommend:
- HPA for pods
- Cluster Autoscaler / node scaling strategy
- If user wants higher automation, discuss Node Auto Provisioning where available (if asked)

### Step 6 — Identity and secrets
- Enable Workload Identity:
  https://learn.microsoft.com/azure/aks/workload-identity-overview
- Use Key Vault CSI Driver:
  https://learn.microsoft.com/azure/aks/csi-secrets-store-driver

### Step 7 — Policy & safeguards
- Turn on Azure Policy and Deployment Safeguards (warn/enforce).
Docs: https://learn.microsoft.com/azure/aks/deployment-safeguards

### Step 8 — Observability baseline
- Enable monitoring using Azure Monitor guidance:
  https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable
- Managed Prometheus overview:
  https://learn.microsoft.com/azure/azure-monitor/metrics/prometheus-metrics-overview

### Step 9 — Upgrades & patching
- Define upgrade approach:
  https://learn.microsoft.com/azure/architecture/operator-guides/aks/aks-upgrade-practices
- Configure node OS upgrade channels:
  https://learn.microsoft.com/azure/aks/auto-upgrade-node-os-image
- Configure cluster autoupgrade channels:
  https://learn.microsoft.com/azure/aks/auto-upgrade-cluster

### Step 10 — Cost visibility
- Enable AKS cost analysis add-on (OpenCost-based):
  https://learn.microsoft.com/azure/aks/cost-analysis

Return a final output with:
- recommended config
- Day-0 checklist
- Day-1 checklist
- optional command/IaC skeleton

---

## Guardrails / Safety
- Do not request or output secrets (tokens, keys, subscription IDs).
- If requirements are ambiguous, propose 2–3 safe options with tradeoffs and choose a conservative default.
- Do not promise zero downtime; advise workload safeguards (PDBs, probes, replicas) and staged upgrades.
- If user asks for actions that require privileged access, provide a plan and commands with placeholders.

---

## Quality Bar
A high-quality answer:
- flags Day-0 irreversible choices (networking, API server access),
- includes identity/secrets/policy defaults (Workload ID + Key Vault CSI + safeguards),
- includes observability baseline,
- includes upgrade/patch plan,
- includes cost visibility.

---

## References (Public)
- AKS Automatic overview: https://learn.microsoft.com/azure/aks/intro-aks-automatic
- Azure CNI Overlay (setup and parameters): https://learn.microsoft.com/azure/aks/azure-cni-overlay
- Azure CNI powered by Cilium: https://learn.microsoft.com/azure/aks/azure-cni-powered-by-cilium
- Microsoft Entra Workload ID on AKS: https://learn.microsoft.com/azure/aks/workload-identity-overview
- Key Vault provider for Secrets Store CSI Driver: https://learn.microsoft.com/azure/aks/csi-secrets-store-driver
- Deployment Safeguards: https://learn.microsoft.com/azure/aks/deployment-safeguards
- Enable AKS monitoring (Prometheus + Grafana + logs): https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable
- Azure Monitor managed Prometheus overview: https://learn.microsoft.com/azure/azure-monitor/metrics/prometheus-metrics-overview
- AKS patch & upgrade practices (Day-2 guidance): https://learn.microsoft.com/azure/architecture/operator-guides/aks/aks-upgrade-practices
- Node OS auto-upgrade channels: https://learn.microsoft.com/azure/aks/auto-upgrade-node-os-image
- Cluster auto-upgrade channels: https://learn.microsoft.com/azure/aks/auto-upgrade-cluster
- AKS cost analysis (OpenCost-based): https://learn.microsoft.com/azure/aks/cost-analysis
``