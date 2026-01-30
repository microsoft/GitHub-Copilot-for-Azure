# Package Validation

Verify all services can be built.

## Command

```bash
azd package --no-prompt
```

## What It Checks

- Dockerfiles build successfully (containerized services)
- Application code compiles
- Dependencies resolve
- Build artifacts created

## Common Errors

| Error | Fix |
|-------|-----|
| Dockerfile not found | Create Dockerfile at path specified in azure.yaml |
| Build failed | Check build logs, fix compilation errors |
| Missing dependencies | Update requirements.txt, package.json, etc. |
| Docker not running | Start Docker Desktop |

## Debug Build Issues

```bash
# Build specific service manually
docker build -t test ./src/api

# Check Docker logs
docker logs <container-id>
```
