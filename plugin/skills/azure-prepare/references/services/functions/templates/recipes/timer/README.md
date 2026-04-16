# Timer Recipe

Scheduled/cron trigger for periodic task execution.

## Template Selection

Resource filter: `timer`  
Discover templates via MCP or CDN manifest where `resource == "timer"` and `language` matches user request.

## Cron Expressions

| Schedule | Expression |
|----------|------------|
| Every 5 minutes | `0 */5 * * * *` |
| Every hour | `0 0 * * * *` |
| Every day at midnight | `0 0 0 * * *` |
| Every Monday at 9am | `0 0 9 * * 1` |
| Every 30 seconds | `*/30 * * * * *` |

> Azure uses 6-part cron expressions (with seconds). Validate at [crontab.guru](https://crontab.guru/).

## Troubleshooting

### Timer Not Firing

**Cause:** Invalid cron expression or function app not running.  
**Solution:** Verify cron syntax; check function app is started and healthy.

### Duplicate Executions

**Cause:** Multiple instances running the same timer.  
**Solution:** Timer triggers use Storage lease to ensure single execution. Verify `AzureWebJobsStorage` is configured.

## Eval

| Path | Description |
|------|-------------|
| [eval/summary.md](eval/summary.md) | Evaluation summary |
| [eval/python.md](eval/python.md) | Python evaluation results |
