# Azure SQL Recipe

SQL change tracking trigger with Entra ID managed identity authentication.

## Template Selection

Resource filter: `sql`  
Discover templates via MCP or CDN manifest where `resource == "sql"` and `language` matches user request.

## Note

SQL trigger requires change tracking enabled on the table:

```sql
ALTER DATABASE [YourDatabase] SET CHANGE_TRACKING = ON;
ALTER TABLE [dbo].[ToDo] ENABLE CHANGE_TRACKING;
```

## Eval

| Path | Description |
|------|-------------|
| [eval/summary.md](eval/summary.md) | Evaluation summary |
| [eval/python.md](eval/python.md) | Python evaluation results |
