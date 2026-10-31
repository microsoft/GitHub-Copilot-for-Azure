# Local Run & Deployment — Go

```bash
func start           # auto-compiles the Go module, hosts locally
func pack            # produces a zip with the cross-compiled `app` binary at the root
```

Run `func pack` from a directory scaffolded by `func init --worker-runtime go` — it handles the `CGO_ENABLED=0 GOOS=linux GOARCH=amd64` cross-compile and packages the artifact for you. The resulting zip works with any Functions deployment path: `azd deploy`, `func azure functionapp publish`, or [zip push deployment](https://learn.microsoft.com/en-us/azure/azure-functions/deployment-zip-push):

```bash
az functionapp deployment source config-zip \
    -g <RG> -n <APP_NAME> --src <appname>.zip
```

## Infrastructure

Go on Flex Consumption requires runtime-specific IaC settings (`runtime.name='go'`, `runtime.version='1.0'`, `http20Enabled=false`, no `FUNCTIONS_WORKER_RUNTIME` app setting). For infrastructure creation and full deployment via `azd up`, hand off to the `azure-prepare` skill. Discover the current Go templates with `functions_template_get(language: "go")`; use a matching published template when available, otherwise generate equivalent Bicep or Terraform with the settings above.

## Hand-building the binary

⚠️ **The compiled binary MUST be named exactly `app`** (lowercase, no extension) and sit at the **root** of the deployment zip. The Flex Consumption host executes `/home/site/wwwroot/app` — any other filename or location fails to start with no useful error.

`func pack` handles this for you. If you build by hand, use one of:

```bash
# Path A — you invoke `func pack --no-build` afterwards.
# func pack expects the binary at bin/app (matches its own local layout).
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/app .
func pack --no-build

# Path B — you zip the artifact yourself. Build to app at project root, then zip so `app` is at zip root.
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o app .
zip -X deploy.zip app host.json           # `-X` preserves Unix perms; add other runtime files as needed
```

**Anti-patterns** (all fail at start with no diagnostic):

| Command | Produces | Why it fails |
| --- | --- | --- |
| `go build .` | `<module-name>` or `<module-name>.exe` | Wrong filename |
| `go build -o myapp .` | `myapp` | Wrong filename |
| `go build -o app.exe .` | `app.exe` | Windows extension |
| `go build -o bin/app .` then zipping `bin/` into the archive | `bin/app` at zip root | Binary must be at zip root, not in `bin/` |

## Hand-rolling the zip

If you build the deployment zip yourself (e.g., a Windows CI job that skips `func pack`), the `app` entry must carry Unix executable permissions (mode `0755` or `0777`) in the zip's external attributes — this is a zip-format-level bit, not an NTFS ACL. Windows tools like PowerShell's `Compress-Archive` and Explorer's "Send to → Compressed folder" emit DOS-mode zips with no Unix permission bits; the host will fail to exec `app` on Linux with a permission-denied error.

Use one of:
- `func pack` — works on any host OS and stamps the bits correctly (preferred).
- WSL's `zip` (or Linux/macOS `zip -X`).
- A CI step that explicitly sets the executable bit before/after zipping.
