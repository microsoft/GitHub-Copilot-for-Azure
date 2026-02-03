# App Service Troubleshooting

## Common Issues

| Symptom | Check |
|---------|-------|
| 503 Service Unavailable | App logs, memory/CPU usage |
| Slow cold start | Always On setting, app startup |
| Deployment failures | Deployment logs, slot swap |

## View Logs

```bash
az webapp log tail --name APP -g RG
```
