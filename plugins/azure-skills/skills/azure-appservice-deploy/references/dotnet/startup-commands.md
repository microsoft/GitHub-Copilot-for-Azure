# Startup Commands by Framework

## Default: no startup override

For ASP.NET Core (MVC, Web API, Minimal API, Razor Pages, Blazor Web App/Server), App Service starts the published assembly automatically. Do not run `dotnet run`, deploy `launchSettings.json` as production configuration, or add a startup script unnecessarily.

The assembly name is `<AssemblyName>` in the project file, otherwise the project file's base name. A custom startup command, **only when needed**, uses the published DLL:

```bash
az webapp config set -n <app> -g <rg> --startup-file "dotnet MyWebApp.dll"
```

```powershell
az webapp config set -n <app> -g <rg> --startup-file "dotnet MyWebApp.dll"
```

If reusing an app with a stale custom command, explain it and clear it for automatic startup:

```bash
az webapp config set -n <app> -g <rg> --startup-file ""
```

```powershell
az webapp config set -n <app> -g <rg> --startup-file ""
```

## Port binding

Use App Service's injected ASP.NET Core hosting configuration. Do not hard-code localhost or the local development HTTPS port, or override `ASPNETCORE_URLS` just to reproduce `launchSettings.json`. Explicit `UseUrls`, `ListenLocalhost` or Kestrel endpoint settings can override the platform configuration; remove/adjust those only with the user's knowledge so the app listens on all interfaces at the platform port.

Blazor Web App/Server uses persistent SignalR connections. If interactive sessions disconnect, check App Service WebSockets and session affinity settings; do not treat standalone WASM as a server application.

## Production settings

- Keep `ASPNETCORE_ENVIRONMENT` at `Production` unless the user explicitly requests a diagnostic change. Never enable the developer exception page publicly as a default fix.
- App settings override `appsettings.json`. Use `__` for nested keys on Linux (e.g., `Logging__LogLevel__Default`).
- Never print secrets or include credentials, certificate private keys or `.pubxml` publish profiles in the ZIP. Use app settings for required existing secrets; additional Azure services are a handoff to `azure-prepare`.
- HTTPS terminates at the platform proxy. If redirects loop, inspect forwarded-header configuration and trust only the appropriate proxies/networks rather than disabling HTTPS globally.
- See [LF normalization](../normalize-scripts.md) before shipping shell/startup/build scripts.

## Diagnosing a wrong startup command

Use these commands only after a failure or when the user requests troubleshooting.

```bash
# Current value
az webapp config show -n <app> -g <rg> --query linuxFxVersion -o tsv
az webapp config show -n <app> -g <rg> --query appCommandLine -o tsv
```

Look for a stale startup command, a runtime mismatch, or an app bound to localhost. See [errors.md](../errors.md) for fixes.
