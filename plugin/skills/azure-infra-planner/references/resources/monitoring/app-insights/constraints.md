## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Log Analytics** | Workspace-based App Insights (recommended) requires `WorkspaceResourceId`. Classic (standalone) is being phased out. |
| **Function App** | Set `APPLICATIONINSIGHTS_CONNECTION_STRING` or `APPINSIGHTS_INSTRUMENTATIONKEY` in function app settings. |
| **App Service** | Set `APPLICATIONINSIGHTS_CONNECTION_STRING` in app settings. Enable auto-instrumentation for supported runtimes. |
| **AKS** | Use Container Insights (different from App Insights) for cluster-level monitoring. App Insights used for application-level telemetry. |
| **Private Link** | Use Azure Monitor Private Link Scope (AMPLS) to restrict ingestion/query to private networks. |
| **Retention** | If workspace-based, retention is governed by the Log Analytics workspace. Component-level retention acts as an override. |
