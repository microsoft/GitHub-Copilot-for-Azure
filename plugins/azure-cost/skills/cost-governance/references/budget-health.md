# Budget Health

1. Call `list_budgets` for the target scope. Distinguish no budgets from access
   denied.
2. Call `forecast_costs` on the same scope. For each date, use Actual when
   present, otherwise Forecast, then sum by currency. If no forecast rows exist,
   report month-to-date actual without presenting it as a projection.
3. Call `query_costs` for month-to-date spend grouped by `ServiceName`. Use the
   budget response's current spend as the source of truth for budget percentage;
   use the query only for driver analysis.
4. Call `list_alerts`. Treat only alerts whose `periodStartDate` matches the
   current period as currently firing; label older alerts as history.
5. Show budget amount, current spend, percent used, end-of-period forecast,
   current alerts, and top cost drivers. Keep currencies separate.

If no budget exists, offer the [Budget Setup](budget-setup.md) workflow.
