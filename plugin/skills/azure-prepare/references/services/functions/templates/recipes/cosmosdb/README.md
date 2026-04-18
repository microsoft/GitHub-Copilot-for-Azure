# Cosmos DB Recipe

Cosmos DB change feed trigger with managed identity authentication.

## Template Selection

Resource filter: `cosmos`  
Discover templates via MCP or CDN manifest where `resource == "cosmos"` and `language` matches user request.

## Note: Dual RBAC System

Cosmos DB uses **two separate RBAC systems**:

- **Azure RBAC** — for control plane (account management)
- **Cosmos SQL RBAC** (`sqlRoleAssignments`) — for data plane (read/write documents)

The MCP template configures both. If you see "Forbidden" on data operations, check that the SQL role assignment exists.

## Eval

| Path | Description |
|------|-------------|
| [eval/summary.md](eval/summary.md) | Evaluation summary |
| [eval/python.md](eval/python.md) | Python evaluation results |
