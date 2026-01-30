# Post-Deployment

Verify and monitor deployed resources.

## View Deployed Resources

```bash
azd show
```

## Open Azure Portal

```bash
azd monitor --overview
```

## View Application Logs

```bash
azd monitor --logs
```

## View Live Metrics

```bash
azd monitor --live
```

## Update Manifest

Record deployment outcome in `.azure/preparation-manifest.md`:

```markdown
## Status: Deployed

## Endpoints

| Service | URL |
|---------|-----|
| api | https://api-xxxx.azurecontainerapps.io |
| web | https://web-xxxx.azurestaticapps.net |
```
