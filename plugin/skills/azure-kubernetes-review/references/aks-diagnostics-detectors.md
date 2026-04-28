# AKS Diagnostics Detectors Reference

This reference documents the AKS built-in diagnostics detectors available through Azure's "Diagnose and solve problems" capability. These detectors provide runtime risk alerts and health assessments that supplement the static checklist matrix.

## Extraction Methods (Priority Order)

### 1. AKS MCP Server (Primary)

Use the AKS MCP tools to extract diagnostics data programmatically:

1. **List all available detectors**:
   - Tool: `mcp_aks_mcp_list_detectors`
   - Parameters: `cluster_resource_id` (full ARM resource ID of the managed cluster, e.g. `/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.ContainerService/managedClusters/<cluster>`)
   - Returns: List of all detector names, descriptions, and categories.

2. **Run detectors by category**:
   - Tool: `mcp_aks_mcp_run_detectors_by_category`
   - Parameters: `cluster_resource_id`, `category`
   - Run once per category listed below.

3. **Run a specific detector** (for deeper investigation):
   - Tool: `mcp_aks_mcp_run_detector`
   - Parameters: `cluster_resource_id`, `detector_name`

> 💡 **Tip:** A live `mcp_aks_mcp_list_detectors` call against a representative AKS cluster returned ~119 detectors across 14 categories (8 core + 6 supplemental). Treat the cluster's live inventory as authoritative; the tables below are reference baselines.

### 2. Azure REST API (Fallback)

If MCP tools are unavailable, use the AKS Diagnostics REST API via Azure CLI:

```bash
# List all detectors
az rest --method get \
  --url "/subscriptions/<subscriptionId>/resourceGroups/<resourceGroup>/providers/Microsoft.ContainerService/managedClusters/<clusterName>/detectors?api-version=2025-10-01"

# Run a specific detector
az rest --method get \
  --url "/subscriptions/<subscriptionId>/resourceGroups/<resourceGroup>/providers/Microsoft.ContainerService/managedClusters/<clusterName>/detectors/<detectorName>?api-version=2025-10-01"
```

### 3. Azure AppLens / Diagnostics API (Alternative)

```bash
# List available detectors via the diagnostics provider
az rest --method get \
  --url "/subscriptions/<subscriptionId>/resourceGroups/<resourceGroup>/providers/Microsoft.ContainerService/managedClusters/<clusterName>/providers/Microsoft.ResourceHealth/diagnostics?api-version=2025-10-01"
```

## Detector Categories

The detector inventory has two layers of category handling:

1. **Core audit categories**: the eight categories that must always be queried during an audit.
2. **Supplemental live categories**: additional categories that may appear in the live detector inventory for a specific cluster and should be incorporated when present.

### Core Audit Categories

| Category | Audit Relevance | Pillar Alignment |
| --- | --- | --- |
| Best Practices | Direct alignment with checklist controls | All pillars |
| Cluster and Control Plane Availability and Performance | API server health, etcd latency, control plane SLA | Reliability, Performance Efficiency |
| Connectivity Issues | DNS, networking, load balancer, ingress, egress | Security, Reliability |
| Create, Upgrade, Delete and Scale | Upgrade readiness, scaling failures, provisioning issues | Reliability, Operational Excellence, Performance Efficiency |
| Deprecations | Deprecated APIs, features, or configurations requiring action | Operational Excellence |
| Identity and Security | RBAC, Microsoft Entra ID, secrets, network policies, Defender findings | Security |
| Node Health | Node readiness, resource pressure, OS/kernel issues | Reliability, Performance Efficiency |
| Storage | PV/PVC issues, CSI driver health, disk attach failures | Reliability |

### Supplemental Live Categories

The live detector catalog can also return additional categories. These are not a replacement for the core eight. They should be enumerated from `mcp_aks_mcp_list_detectors` and incorporated into the report when present.

| Category | Typical Content | Handling Guidance |
| --- | --- | --- |
| Risk Alerts | Cross-category risk summaries such as availability, reliability, and support-eligibility alerts (e.g. `riskalerts-availability`, `riskalerts-reliability`, `riskalerts-support-eligibility`) | Always capture. Treat as high-value supplemental evidence and include all Critical and Warning results in the Risk Alerts table. |
| Control Plane | Focused control plane detectors such as scheduler-specific analysis (e.g. `KubeScheduler`) | Capture and cross-reference to reliability and performance checks where applicable. |
| Keystone | Service-specific platform diagnostics surfaced by the AKS diagnostics backend (e.g. `keystone`) | Capture as supplemental evidence. If no checklist item maps cleanly, keep in the diagnostics section only. |
| Workflow Nodes | Guided troubleshooting nodes rather than direct compliance detectors (e.g. `operation-troubleshooter`, Kusto spoke providers) | Record availability and use them to drive deeper investigation, but do not score them as standalone checklist controls unless they emit concrete findings. |
| zWorkflowDetectors | Reconciliation workflow detectors (e.g. `ReconcileManagedCluster`, `ReconcileNodePool`) used for orchestration rather than direct compliance scoring | Record availability. Run only when investigating a specific reconcile/operation failure; do not score as standalone checklist controls. |
| Analysis - L2 Support Topic | Topic-level analysis aggregators that fan out to multiple underlying detectors (e.g. `st-l2-analysis-connectivity`, `st-l2-analysis-crud`, `st-l2-analysis-storage`) | Run when category-level execution is needed for the matching topic. Treat outputs as cross-references to the relevant core category rather than as new checklist controls. |
| Analysis - L3 Support Topic | Scenario-specific analysis nodes for targeted investigations (e.g. `st-l3-analysis-cluster-upgrade`, `st-l3-node-high-cpu-mem`, `st-l3-analysis-creating-nodepool`) | Use on demand to drill into a specific failure scenario surfaced by core detectors or risk alerts. Capture findings as supplemental evidence linked to the impacted checklist item. |

### Category Execution Rules

1. Query all eight core audit categories on every audit.
2. Enumerate supplemental live categories from the detector inventory on every audit.
3. If a supplemental category supports category-level execution, run it.
4. If category-level execution is not supported, run the underlying detectors individually where possible.
5. If a supplemental category is inventory-only (for example a workflow or overview node), record it as supplemental metadata with handling notes.
6. Do not let supplemental-category coverage replace or weaken the requirement to query the core eight.

## Severity Levels

Detector findings use the following severity levels:

| Severity | Meaning | Audit Impact |
| --- | --- | --- |
| Critical | Active issue causing service impact or significant risk | Must be addressed; may override checklist status to `Does not meet` |
| Warning | Potential risk or degraded posture detected | Should be addressed; may affect checklist status |
| Info | Informational finding with no immediate risk | Record as evidence; no status change required |
| Healthy | Detector ran and no issues detected | Positive evidence for checklist items |
| None | Detector returned no severity (informational or not applicable) | Record as supplemental context; verify the detector executed correctly |

## Mapping Detectors to Checklist Items

When a detector finding relates to an existing checklist item (from the checklist matrix), cross-reference it:

| Detector Category | Likely Checklist Alignment |
| --- | --- |
| Best Practices | `AKS-OP-*`, `AKS-DEV-*`, `AKSC-*`, `COST-*`, `CTR-*`, `OPS-04` |
| Cluster and Control Plane Availability and Performance | `REL-01` through `REL-08`, `PERF-01` through `PERF-05`, `OPS-03` |
| Connectivity Issues | `SEC-03`, `SEC-04`, `SEC-09`, `AKS-NET-*`, `AKSC-NET-*` |
| Create, Upgrade, Delete and Scale | `AKS-CSEC-01`, `AKS-CSEC-02`, `OPS-01`, `OPS-02` |
| Deprecations | `AKS-CSEC-01`, `OPS-01` |
| Identity and Security | `SEC-01` through `SEC-10`, `AKS-ID-*`, `OPS-05` |
| Node Health | `REL-04`, `REL-05`, `REL-06`, `PERF-01`, `PERF-03` |
| Storage | `AKS-STO-01`, `AKS-STO-02`, `AKSC-BCDR-03` |

### Cross-Reference Rules

1. If a detector finding directly validates or contradicts a checklist item, update that item's `Evidence Summary` and `Comments` with the detector output.
2. If a detector finding has no matching checklist item, include it only in the AKS Diagnostics Findings section (not in the main Detailed Analysis table).
3. If a Critical detector finding contradicts a checklist item's `Meets` status, re-evaluate and downgrade the status with explanation.
4. Detector findings supplement but do not replace validation command evidence for checklist items.
5. Supplemental categories such as `Risk Alerts`, `Control Plane`, and `Keystone` can influence checklist status when they contain concrete detector findings.
6. `Workflow Nodes`, `zWorkflowDetectors`, and category-overview detectors (e.g. `aks-category-*`) are supporting evidence and orchestration aids; they should not be scored as direct control checks unless a concrete detector result is also captured.
7. `Analysis - L2/L3 Support Topic` detectors are scenario aggregators; map their findings back to the matching core category rather than treating them as new controls.

## Interpretation Guidelines

- **Risk Alerts**: The AKS diagnostics API exposes a concrete `Risk Alerts` category that aggregates cross-category risk summaries (see Supplemental Live Categories above). This is distinct from the general concept of risk-level findings, which are any `Critical` or `Warning` results returned by detectors in any category. Capture the `Risk Alerts` category results in the Risk Alerts table; cross-reference individual Critical/Warning findings from other categories to their respective checklist items.
- **Troubleshooting Results**: The full set of detector outputs organized first by the eight core audit categories, then by any supplemental live categories. Even `Healthy` results provide positive evidence for the audit.
- **Detector Descriptions**: Each detector includes a description of what it checks. Record this in the evidence to explain what was assessed.
- **Time Sensitivity**: Detector results are point-in-time snapshots. Record the timestamp of execution in the report.
- **Supplemental Category Semantics**: A live category can represent a concrete detector bucket, a summary view, or a troubleshooting workflow. Preserve the returned detector type in the report so readers understand whether the item is scored evidence or supporting context.

## Guardrails / Safety

- Do not skip execution of any detector. ALL detectors MUST be run.
