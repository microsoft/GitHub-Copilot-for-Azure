# Azure Kubernetes Service Review - <clusterName>

## Table of Contents

1. [Scope](#scope)
2. [Overview of AKS Practices](#overview-of-aks-practices)
3. [Subpage Compliance Rollup](#subpage-compliance-rollup)
4. [Detailed Analysis](#detailed-analysis)
5. [AKS Diagnostics Findings](#aks-diagnostics-findings)
6. [Container Practices Assessment](#container-practices-assessment)
7. [Kubernetes Warning Events by Namespace](#kubernetes-warning-events-by-namespace)
8. [Summary](#summary)
9. [Next Steps](#next-steps)
10. [Appendices](#appendices)

## Scope

- Cluster under review: `<subscriptionId>/<resourceGroup>/<clusterName>`
- Kubernetes context: `<kubeContext>`
- Review date: `<yyyy-mm-dd>`
- Extraction timestamps: `<yyyy-mm-dd HH:mm UTC>` / `<yyyy-mm-dd HH:mm local timezone>`
- Kubernetes version: `<version>`
- Region: `<region>`
- Node count: `<total>` (`<pool breakdown e.g.: 3 pools: system=7, online=11, operations=1>`)
- Review scope:
  - AKS cluster configuration and Kubernetes in-cluster controls only.
- Out of scope:
  - Other Azure resources that are not directly required to validate AKS controls.
- Limitations and constraints:
  - `<list all constraints encountered during discovery and execution>`

## Overview of AKS Practices

This assessment evaluates the AKS cluster against the following sources of practices:

1. AKS practices (operator and developer categories) on Microsoft Learn
2. Azure Well-Architected AKS service guide (Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency) on Microsoft Learn
3. The AKS Checklist at <https://www.the-aks-checklist.com/>
4. AKS Diagnostics Detectors ("Diagnose and solve problems") — runtime risk alerts and health assessments from the Azure platform
5. Container Practices - Per-container assessment of image hygiene, security context, resource management, health probes, pod-level security, configuration hygiene, and network controls.

The report combines Azure platform evidence (`az`), Kubernetes evidence (`kubectl`), and AKS diagnostics detector outputs to determine adherence status per checklist item.

## Executive Summary

Provide an Executive Summary consisting of two paragraphs; the first paragraph will contain the key areas where the AKS cluster shows strength and best practices. The second paragraph will itemise the top 5 area requiring attention.

| Metric | Value |
|---|---|
| **Overall Compliance Score** |  |
| Total Checks Assessed |  |
| Meets |  |
| Partially Meets |  |
| Does Not Meet |  |
| Not Applicable |  |
| Not Assessed |  |

## Critical Findings Summary

| # | Finding | Severity | Impact | Checklist Reference |
|---|---------|----------|--------|-------------------|

---

## Subpage Compliance Rollup

| Parent Page | Child Page | Total Checks | Scored Checks | Meets | Partially meets | Does not meet | Not applicable | Not assessed | Compliance % |
|---|---|---|---|---|---|---|---|---|---|
| `<Cluster operator best practices>` | `<Network connectivity>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<0-100 or N/A>` |

Scoring formula:
- `Compliance % = ((Meets + (0.5 * Partially meets)) / Scored Checks) * 100`
- If `Scored Checks = 0`, set `Compliance %` to `N/A`.

## Detailed Analysis

| Check ID | Parent Page | Child Page | Pillar/Category | Checklist Item | Summary | Microsoft Learn Reference | Commands Executed | Evidence Summary | Comments | Status | Remediation Options (up to 5) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `<AKS-NET-02>` | `<Cluster operator best practices>` | `<Network connectivity>` | `<Security>` | `<item>` | `<intent and architecture impact>` | `<url>` | `<command 1><br><command 2>` | `<key outputs or error details>` | `<context, assumptions, or limitations>` | `<Meets/Partially meets/Does not meet/Not applicable/Not assessed>` | `1) <action>` `<br>` `2) <action>` `<br>` `3) <action>` |

## AKS Diagnostics Findings

Findings from the AKS cluster's built-in diagnostics detectors (Azure "Diagnose and solve problems"), extracted at `<yyyy-mm-dd HH:mm UTC>`.

Extraction method used: `<AKS MCP Server / Azure REST API / Manual>`

### Risk Alerts

Findings with Critical or Warning severity across all detector categories.

| Detector | Category | Severity | Status | Description | Affected Resources | Recommendations |
|---|---|---|---|---|---|---|
| `<detectorName>` | `<Best Practices>` | `<Critical/Warning>` | `<Unhealthy/Warning>` | `<description of the risk>` | `<affected resource identifiers>` | `<recommended actions>` |

If no Critical or Warning findings exist, state: _No risk alerts detected._

### Detector Results by Category

Full results from all eight detector categories.

| Category | Detector | Status | Key Findings | Cross-Referenced Check IDs |
|---|---|---|---|---|
| `<Best Practices>` | `<detectorName>` | `<Critical/Warning/Info/Healthy/None>` | `<summary of findings>` | `<SEC-01, AKS-ID-01 or N/A>` |
| `<Cluster and Control Plane Availability and Performance>` | `<detectorName>` | `<status>` | `<summary>` | `<REL-01 or N/A>` |
| `<Connectivity Issues>` | `<detectorName>` | `<status>` | `<summary>` | `<AKS-NET-01 or N/A>` |
| `<Create, Upgrade, Delete and Scale>` | `<detectorName>` | `<status>` | `<summary>` | `<AKS-CSEC-01 or N/A>` |
| `<Deprecations>` | `<detectorName>` | `<status>` | `<summary>` | `<AKS-CSEC-01 or N/A>` |
| `<Identity and Security>` | `<detectorName>` | `<status>` | `<summary>` | `<SEC-01 or N/A>` |
| `<Node Health>` | `<detectorName>` | `<status>` | `<summary>` | `<REL-04 or N/A>` |
| `<Storage>` | `<detectorName>` | `<status>` | `<summary>` | `<AKS-STO-01 or N/A>` |

Categories queried: Best Practices, Cluster and Control Plane Availability and Performance, Connectivity Issues, Create, Upgrade, Delete and Scale, Deprecations, Identity and Security, Node Health, Storage.

Supplemental live categories returned by the detector inventory, if any, should be listed separately with their detector type and handling notes.

### Diagnostics Impact on Checklist Assessment

List any checklist items whose status was adjusted based on diagnostics findings.

| Check ID | Original Status | Adjusted Status | Diagnostics Justification |
|---|---|---|---|
| `<SEC-01>` | `<Meets>` | `<Does not meet>` | `<Critical finding from Identity and Security detector: description>` |

If no adjustments were made, state: _No checklist items required status adjustment based on diagnostics findings._

## Container Practices Assessment

Container-level best-practice findings assessed at `<yyyy-mm-dd HH:mm UTC>`. Checks are sourced from the [AKS Container Best Practices Reference](../references/aks-container-best-practices.md).

### Container Summary Statistics

Container counting methodology: All running container instances are counted (including scaled replicas and injected sidecar/proxy containers). Sidecar containers are reported separately where they materially affect compliance metrics.

| Metric | Cluster-Wide Count | Percentage | Notes |
|---|---|---|---|
| Total containers assessed | `<n>` | — | Across all namespaces in scope |
|  of which sidecar/proxy containers | `<n>` | `<n>%` | Linkerd, Istio, Envoy, etc. |
| Containers without CPU/memory requests | `<n>` | `<n>%` | Excludes system namespaces |
| Containers without CPU/memory limits | `<n>` | `<n>%` | Excludes system namespaces |
| Containers running as root (or runAsNonRoot not set) | `<n>` | `<n>%` (app-only: `<n>%`) | Excludes system namespaces |
| Containers without readiness probes | `<n>` | `<n>%` | Excludes init containers and system namespaces |
| Containers using `:latest` tag or no tag | `<n>` | `<n>%` | All namespaces |
| BestEffort QoS pods | `<n>` | `<n>%` | All namespaces |
| Privileged containers | `<n>` | `<n>%` | Excludes system namespaces |
| Containers with sensitive inline env vars | `<n>` | `<n>%` | Excludes system namespaces |
| Pods using `default` service account | `<n>` | `<n>%` | Excludes system namespaces |

### Container Checks by Category Rollup

| Category | Total Checks | Scored Checks | Meets | Partially meets | Does not meet | Not applicable | Not assessed | Compliance % |
|---|---|---|---|---|---|---|---|---|
| Image Hygiene | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<0-100 or N/A>` |
| Container Security Context | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<0-100 or N/A>` |
| Resource Management | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<0-100 or N/A>` |
| Health Probes and Lifecycle | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<0-100 or N/A>` |
| Pod-Level Security Controls | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<0-100 or N/A>` |
| Container Configuration Hygiene | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<0-100 or N/A>` |
| Network and Service Mesh Controls | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<0-100 or N/A>` |
| ACR and Image Supply Chain | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<n>` | `<0-100 or N/A>` |

Scoring thresholds: ≥80% container compliance = Meets, 50-79% = Partially meets, <50% = Does not meet.

### Container Checks Detail

| Check ID | Category | Checklist Item | Commands Executed | Cluster-Wide Compliance % | Failing Namespaces | Status | Remediation Options (up to 5) |
|---|---|---|---|---|---|---|---|
| `<CTR-IMG-01>` | `<Image Hygiene>` | `<Container images do not use the :latest tag>` | `<command 1><br><command 2>` | `<0-100>%` | `<ns1, ns2 or None>` | `<Meets/Partially meets/Does not meet/Not applicable/Not assessed>` | `1) <action>` `<br>` `2) <action>` |

### System Namespace Findings

Findings for system namespaces (`kube-system`, `kube-node-lease`, `kube-public`, `gatekeeper-system`) are reported separately. Violations in system namespaces may be expected for infrastructure components (CNI plugins, CSI drivers, monitoring agents).

| Namespace | Check ID | Finding Summary | Justification |
|---|---|---|---|
| `<kube-system>` | `<CTR-SEC-04>` | `<2 containers run in privileged mode>` | `<Expected: CNI plugin and CSI driver require privileged access>` |

If no system namespace findings require attention, state: _All system namespace container configurations are consistent with expected infrastructure requirements._

If `kubectl` access is unavailable, state: _Container best practices assessment could not be performed — kubectl access unavailable. Platform-level checks (CTR-IMG-06, CTR-ACR-*) assessed via az CLI where applicable._

## Kubernetes Warning Events by Namespace

Warning-type Kubernetes events collected across all namespaces at `<yyyy-mm-dd HH:mm UTC>`. Event correlation window: `<30 days via Azure Monitor Logs | etcd-only: <firstTimestamp> to <lastTimestamp>>`. Each event is correlated to the owning top-level workload (Deployment, StatefulSet, DaemonSet, Job, or CronJob).

| Namespace | Event Reason | Message Summary | Occurrences | First Seen | Last Seen | Source Component | Affected Workload(s) | Remediation Steps |
|---|---|---|---|---|---|---|---|---|
| `<namespace>` | `<BackOff>` | `<Back-off pulling image "registry/image:tag">` | `<12>` | `<yyyy-mm-dd HH:mm>` | `<yyyy-mm-dd HH:mm>` | `<kubelet>` | `<Deployment/my-app>` | `1) <step>` `<br>` `2) <step>` `<br>` `3) <step>` |

**Column rules:**
- **Namespace**: The Kubernetes namespace where the event was emitted.
- **Event Reason**: The Kubernetes event `.reason` field (e.g., `BackOff`, `FailedScheduling`, `Unhealthy`, `FailedMount`, `FailedCreate`, `OOMKilling`).
- **Message Summary**: A concise version of the event `.message`. Truncate to 200 characters if needed; include the essential detail (image name, resource name, error text).
- **Occurrences**: The event `.count` (number of times observed).
- **First Seen** / **Last Seen**: From `.firstTimestamp` and `.lastTimestamp`.
- **Source Component**: From `.source.component` (e.g., `kubelet`, `default-scheduler`, `kube-controller-manager`).
- **Affected Workload(s)**: The resolved top-level owning workload in `<Kind>/<Name>` format (e.g., `Deployment/my-app`, `StatefulSet/redis`). If a single event reason affects multiple workloads in the same namespace, list all separated by `<br>`. **Never show only the Pod name** — always resolve through the owner chain.
- **Remediation Steps**: A numbered list of up to 5 implementation-ready actions specific to the event reason and message. Include exact commands, configuration changes, or resource adjustments.

If no Warning events exist across any namespace, state: _No Kubernetes Warning events detected._

If `kubectl` access is unavailable, state: _Warning events could not be collected — kubectl access unavailable._

### Deep-Dive on <namespace> Probe Failures

_Include this sub-section when any workload has recurring `Unhealthy` events (≥10 occurrences or ≥7 day span). Produce one sub-section per affected namespace. Omit entirely if no workloads meet the threshold._

| Workload | Live Evidence | Interpretation | Recommended Change |
| --- | --- | --- | --- |
| `<deployment-name>` | `<Factual synthesis of deployment spec, probe config (timeoutSeconds, periodSeconds, failureThreshold, initialDelaySeconds), event patterns, application logs, and proxy/sidecar logs. Reference specific errors: timeout exceptions, circuit-breaker opens, connection refused, HTTP 502/503, dependency throttling, protocol-detection timeouts.>` | `<Root-cause determination: true crash vs. dependency-induced latency vs. startup timing vs. rollout churn vs. probe misconfiguration. State whether failures are steady-state or transient.>` | `<Implementation-ready recommendation addressing root cause: health endpoint redesign, circuit-breaker tuning, startup probe introduction, rollout smoothing — not just probe timeout adjustments.>` |

## Summary

<One or two paragraphs that summarize overall adherence, major risks, and the most important hardening priorities.>

## Next Steps — Prioritized Remediation Roadmap

### Immediate (0–2 weeks)

1. `<Critical security/reliability item with owner and CLI command>`
2. `<Critical item with owner and CLI command>`

### Short-term (2–6 weeks)

3. `<High-severity hardening item with owner>`
4. `<High-severity item with owner>`

### Medium-term (1–3 months)

5. `<Operational maturity improvement with owner>`
6. `<Operational maturity improvement with owner>`

### Long-term (3–6 months)

7. `<Strategic architecture item with owner>`
8. `<Strategic architecture item with owner>`

## Appendices

### Commands Reference

| Purpose | Command |
|---|---|
| Cluster config | `az aks show -g <resourceGroup> -n <clusterName> -o json` |
| Node pools | `az aks nodepool list -g <resourceGroup> --cluster-name <clusterName> -o table` |
| Node image versions | `az aks nodepool list --query "[].{name:name,nodeImageVersion:nodeImageVersion}" -o table` |
| Namespaces | `kubectl get namespaces --context <kubeContext>` |
| Network policies | `kubectl get networkpolicy -A --context <kubeContext>` |
| PSS labels | `kubectl get ns -L pod-security.kubernetes.io/enforce --context <kubeContext>` |
| HPAs | `kubectl get hpa -A --context <kubeContext>` |
| KEDA ScaledObjects | `kubectl get scaledobject -A --context <kubeContext>` |
| SecretProviderClasses | `kubectl get secretproviderclass -A --context <kubeContext>` |
| All pods (JSON) | `kubectl get pods -A -o json --context <kubeContext>` |
| Warning events | `kubectl get events -A --field-selector type=Warning -o json --context <kubeContext>` |
| Diagnostic settings | `az monitor diagnostic-settings list --resource <aksResourceId> -o json` |
| Diagnostics detectors | `az rest --method get --url "<aksResourceId>/detectors/<name>?api-version=2024-09-01"` |

