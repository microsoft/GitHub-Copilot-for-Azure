# Diagnostics Workflow

## Step 3: Run Diagnostics Detectors

See [AKS Diagnostics Detectors Reference](./aks-diagnostics-detectors.md) for extraction methods and interpretation rules.

### Primary Method: AKS MCP Server

1. Call `mcp_aks_mcp_list_detectors` to enumerate available detectors.
2. **Core audit categories** (always query all 8): `Best Practices`, `Cluster and Control Plane Availability and Performance`, `Connectivity Issues`, `Create, Upgrade, Delete and Scale`, `Deprecations`, `Identity and Security`, `Node Health`, `Storage`.
3. Call `mcp_aks_mcp_run_detectors_by_category` for each core category.
4. Enumerate **supplemental categories** from live catalog (e.g., `Risk Alerts`, `Control Plane`, `Keystone`, `Workflow Nodes`).
5. For supplemental categories: prefer category-level execution; if unsupported, run individual detectors via `mcp_aks_mcp_run_detector` and record why.
6. For Critical/Warning findings needing deeper investigation, call `mcp_aks_mcp_run_detector` with specific detector name.

### Fallback Method

If MCP unavailable, use `az rest` calls to AKS Diagnostics REST API (see detectors reference).

### Post-Processing

- Record extraction timestamp (UTC and local time).
- Classify findings by severity: `Critical`, `Warning`, `Info`, `Healthy/None`.
- Cross-reference findings to checklist items using detectors reference mapping.
- If a Critical finding contradicts a checklist item's `Meets` status, downgrade and record justification.
