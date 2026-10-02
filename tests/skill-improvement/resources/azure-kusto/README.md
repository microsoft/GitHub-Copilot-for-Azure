# Azure Kusto evaluation environment

The persistent test environment is intentionally stopped between runs:

| Setting | Value |
| --- | --- |
| Subscription | `52f7abe2-7856-4f03-9306-4432c1d4c65d` |
| Resource group | `rg-ghcfa-evals` |
| Region | East US 2 |
| Cluster | `ghcfaevalskusto` |
| SKU | `Dev(No SLA)_Standard_E2a_v4`, capacity 1 |
| Database | `IntegrationTests` |

[`bootstrap.kql`](bootstrap.kql) defines deterministic tables, rows, and the
stored function used by `live-connection.eval.yaml`. Its dates and expected
results are fixed so live evaluations remain repeatable without writing data
during each run.

The skill-improvement executor starts the cluster, waits up to 20 minutes,
verifies `print Health=1`, and stops the cluster after evaluation. Azure Data
Explorer automatic stop remains enabled as a backup, but its five-day inactivity
window is not the primary cost-control mechanism.

The workflow identity has cluster-scoped management permission for start/stop
and database `Viewer` access. Bootstrap is performed with a separate database
administrator identity; eval agents remain read-only.
