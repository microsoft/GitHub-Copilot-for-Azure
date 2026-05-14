# Validation & Findings Workflow

## Step 6: Run Validation Commands

1. Execute Azure-platform checks with `az`.
2. **Primary**: Kubernetes checks with `kubectl`. **Fallback**: `az aks command invoke`. If both unavailable, mark `Not assessed`.
3. Prefer read-only commands.
4. Capture evidence: short outputs, key fields, timestamps (UTC and local).
5. **Node image staleness**: `az aks nodepool list --query "[].{name:name,nodeImageVersion:nodeImageVersion}"`. Flag Critical if any pool image >90 days old. Cross-reference `nodeOsUpgradeChannel`.
6. **Inline secrets** (`CTR-CFG-01`): Scan all container env vars for sensitive values. Report exact count — don't dismiss partial findings.
7. Determine status per check: `Meets`, `Partially meets`, `Does not meet`, `Not applicable`, `Not assessed`.
8. **Conservative rule**: Failed/timed-out/insufficient commands → `Not assessed`, never `Meets`.

## Step 7: Produce Detailed Findings

### Per-Check Analysis Table

Each checklist item gets one row with ALL columns: Check ID, Parent Page, Child Page, Pillar/category, Checklist item, Control intent summary, Microsoft Learn URL, Commands run, Evidence summary, Comments, Status, Remediation actions (up to 5).

### Rollup Table

Group by `Parent Page`/`Child Page`: Total Checks, Scored Checks, Meets, Partially meets, Does not meet, Not applicable, Not assessed, Compliance %.

### AKS Diagnostics Findings Section

- **Risk Alerts table**: All Critical/Warning findings from any detector category
- **Detector Results by Category**: Full results from 8 core categories with cross-referenced check IDs
- **Supplemental Categories**: Additional live categories with detector type (`Detector`, `CategoryOverview`, `WorkflowNode`) and handling notes
- **Diagnostics Impact table**: Checklist items whose status was adjusted by detector findings

### Container Best Practices Section

- **Summary Statistics**: Cluster-wide counts/percentages (total containers, without requests, running as root, without probes, latest tags, BestEffort QoS, privileged, inline secrets)
- **Category Rollup**: One row per check category with compliance %
- **Detail Table**: One row per `CTR-*` check with ID, Category, Item, Commands, Compliance %, Per-Namespace Breakdown, Status, Remediation

### Warning Events Section

- **Summary Table**: Namespace, Event Reason, Message Summary, Occurrences, First/Last Seen, Source, Affected Workload(s) (resolved top-level), Remediation Steps (1-5)
- **Probe Failure Deep-Dive**: Sub-section per affected namespace with Workload, Live Evidence, Interpretation, Recommended Change columns
- **Time Window note**: State effective correlation window in preamble

### Remediation Rules

- Implementation-ready with exact Azure/Kubernetes feature names
- Prefer least-privilege and policy-driven controls
- Sequence: short-term mitigation → medium-term hardening → long-term architecture
