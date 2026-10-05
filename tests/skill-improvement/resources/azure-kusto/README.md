# Azure Kusto evaluation environment

The persistent test environment is intentionally stopped between runs:

| Setting | Value |
| --- | --- |
| Subscription | `${AZURE_SUBSCRIPTION_ID}` |
| Resource group | `${AZURE_EVALS_RESOURCE_GROUP}` |
| Region | East US 2 |
| Cluster | `ghcfaevalskusto` |
| SKU | `Dev(No SLA)_Standard_E2a_v4`, capacity 1 |
| Database | `IntegrationTests` |

The database is preloaded with the deterministic tables, rows, and stored
function expected by `live-connection.eval.yaml`. The fixture is persistent:
starting or stopping the cluster does not reload or remove its data. Eval
agents have read-only access and must not modify the fixture.

The skill-improvement executor starts the cluster, waits up to 20 minutes,
verifies `print Health=1`, and stops the cluster after evaluation. Azure Data
Explorer automatic stop remains enabled as a backup, but its five-day inactivity
window is not the primary cost-control mechanism.

The workflow identity has cluster-scoped management permission for start/stop
and database `Viewer` access.
