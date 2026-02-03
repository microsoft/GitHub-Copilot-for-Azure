# Azure Functions Troubleshooting

## Common Issues

| Symptom | Check |
|---------|-------|
| Not triggering | Trigger configuration, host.json |
| Timeout errors | Execution time, plan limits |
| Cold starts | Premium plan, package size |

## View Logs

```bash
func azure functionapp logstream FUNCTIONAPP
```
