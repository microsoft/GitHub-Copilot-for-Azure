## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Application Insights** | App Insights `WorkspaceResourceId` must reference this workspace. Both should be in the same region for optimal performance. |
| **AKS (Container Insights)** | AKS `omsagent` addon references workspace via `logAnalyticsWorkspaceResourceID`. |
| **Diagnostic Settings** | Multiple resources can send diagnostics to the same workspace. Configure via `Microsoft.Insights/diagnosticSettings` on each resource. |
| **Retention** | Free tier is limited to 7-day retention. PerGB2018 supports 30–730 days. Archive tier available for longer retention. |
| **Private Link** | Use Azure Monitor Private Link Scope (AMPLS) for private ingestion/query. A workspace can be linked to up to 100 AMPLS resources (a VNet can connect to only one AMPLS). |
