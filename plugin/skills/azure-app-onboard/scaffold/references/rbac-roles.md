# RBAC — Common Roles Reference

Shared reference for role assignment GUIDs used in both Bicep and Terraform. Loaded by both pattern files.

## Deterministic Role Assignments

Use `guid()` (Bicep) or deterministic naming (Terraform) for reproducible assignment names. Always set `principalType` to `'ServicePrincipal'` — prevents AAD graph lookup delays.

If the required role is NOT in the table below, call `azure__documentation` with the target resource type to look up the correct built-in role definition ID before generating the role assignment.

| Role | ID | Use |
|------|-----|-----|
| AcrPull | `7f951dda-4ed3-4680-a7ca-43fe172d538d` | Container Apps → ACR |
| Key Vault Secrets User | `4633458b-17de-408a-b874-0445c86b69e6` | App → Key Vault secrets |
| Storage Blob Data Contributor | `ba92f5b4-2d11-453d-a403-e96b0029c9fe` | App → Storage blobs (read/write/delete) |
| Storage Blob Data Reader | `2a2b9908-6ea1-4ae2-8e65-a410df84e7d1` | App → Storage blobs (read-only) |
| Storage Queue Data Contributor | `974c5e8b-45b9-4653-ba55-5f855dd0fb88` | App → Storage queues |
| Storage Table Data Contributor | `0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3` | App → Storage tables |
| Azure Service Bus Data Sender | `69a216fc-b8fb-44d8-bc22-1f3c2cd27a39` | App → Service Bus (send) |
| Azure Service Bus Data Receiver | `4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0` | App → Service Bus (receive) |
| Azure Event Hubs Data Sender | `2b629674-e913-4c01-ae53-ef4638d8f975` | App → Event Hubs (send) |
| Azure Event Hubs Data Receiver | `a638d3c7-ab3a-418d-83e6-5f17a39d4fde` | App → Event Hubs (receive) |
| App Configuration Data Reader | `516239f1-63e1-4d78-a4de-a74fb236a071` | App → App Configuration (read) |
| SignalR Service Owner | `7e4f1700-ea5a-4f59-8f37-079cfe29dce3` | App → SignalR |
| Cognitive Services OpenAI User | `5e0bd9bd-7b93-4f28-af87-19fc36ad61bd` | App → Azure OpenAI (inference) |
| Search Index Data Reader | `1407120a-92aa-4202-b7e9-c0e197c71c8f` | App → AI Search (query) |
| Search Index Data Contributor | `8ebe5a00-799e-43f5-93ac-243d3dce84a7` | App → AI Search (read/write index) |
| Monitoring Metrics Publisher | `3913510d-42f4-4e42-8a64-420c390055eb` | App → Azure Monitor (custom metrics) |

## Cosmos DB — Data Plane RBAC (NOT ARM RBAC)

⛔ **Cosmos DB uses its OWN role system** — do NOT use `Microsoft.Authorization/roleAssignments` for Cosmos DB data access. ARM RBAC roles (Contributor, Reader) grant control-plane access only. For data access (read/write documents), use `Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments`.

| System | Resource type | Use for |
|--------|--------------|--------|
| ARM RBAC | `Microsoft.Authorization/roleAssignments` | Subscription/RG-level permissions (Contributor, Reader, Key Vault Secrets User) |
| Cosmos DB data plane | `Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments` | Document read/write access (Data Reader, Data Contributor) |

Built-in Cosmos DB data roles:
- Data Reader: `00000000-0000-0000-0000-000000000001`
- Data Contributor: `00000000-0000-0000-0000-000000000002`

## Delegation

For complex RBAC scenarios (custom roles, cross-subscription, conditional access), AppOnboard does not generate custom role definitions inline. Instead, append an entry to `prepare-plan.json → postDeployRecommendations[]` (schema: `PostDeployRecommendation` in `session-schemas.ts`):

```json
{
  "title": "Configure custom RBAC role for <service>",
  "reason": "<why the built-in roles above are insufficient>",
  "effort": "medium",
  "services": ["<affected-service>"]
}
```

At handoff, the agent will detect this recommendation and offer to call `mcp_azure_mcp_role` to list existing role assignments and create custom roles for the deployed resource group. See `handoff-protocol.md` Skill-Based Next Steps — the RBAC condition row triggers this automatically.
