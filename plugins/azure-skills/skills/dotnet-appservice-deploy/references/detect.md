# Framework Detection

Inspect source before choosing a runtime or ZIP root. Do not modify the framework to make deployment fit.

## What to check

| Indicator | Interpretation |
|---|---|
| `.csproj` / `.fsproj` with `Sdk="Microsoft.NET.Sdk.Web"` | ASP.NET Core web app: Minimal API, Web API, MVC, Razor Pages or server-hosted Blazor |
| `AddRazorComponents` / `MapRazorComponents`, `.razor` files | Blazor Web App; deploy its server project |
| `AddServerSideBlazor` / `MapBlazorHub` | Blazor Server; deploy server project |
| `Sdk="Microsoft.NET.Sdk.BlazorWebAssembly"` only | Standalone WASM: hand off to `azure-prepare` for static hosting |
| Hosted WASM solution with a server web project | Deploy server project and include its client/shared project references |
| `Microsoft.NET.Sdk.Functions` / `Microsoft.Azure.Functions.Worker` | Functions: hand off to `azure-prepare` |
| `net48`, `net472`, `System.Web`, Windows-only dependencies or `net*-windows` | Windows/.NET Framework: hand off to `azure-prepare` |
| Worker/console/class library, no web project | Explain missing web entry; do not pretend it is a web app |

## Framework and SDK

- Read `TargetFramework` / `TargetFrameworks`, imported props (e.g., `Directory.Build.props`), and `global.json`. Select a supported matching App Service runtime; `net10.0` → `DOTNETCORE:10.0`.
- For multiple target frameworks, clarify the intended web target before deployment.
- `global.json` may pin an SDK unavailable in Oryx. Report a build failure honestly; do not silently remove it or retarget.
- Linux paths and file names are case-sensitive.

## Outcomes

### Choose project and archive root

One web project: select it. Multiple web projects: use the user-specified project, otherwise ask which to deploy (this necessary clarification overrides the one-question default).

For CLI source deployment, set `PROJECT` to its path relative to the ZIP root:

```bash
az webapp config appsettings set -n <app> -g <rg> --settings PROJECT="src/Web/Web.csproj" -o none
```

```powershell
az webapp config appsettings set -n <app> -g <rg> --settings PROJECT="src/Web/Web.csproj" -o none
```

Always update `PROJECT` on redeployment when selection changes. Include referenced projects, `Directory.Build.*`, `Directory.Packages.props`, `NuGet.config` and `global.json` within the archive root. Do not ZIP only the web-project folder if it references siblings. Do not upload NuGet credentials or publish-profile secrets.

For azd, check `services.<name>.project` points to the selected web project folder; azd handles `dotnet publish`.

## Front-end assets

Oryx's .NET build runs restore/publish, not an arbitrary front-end pipeline. Honor existing MSBuild targets. If assets need a separate npm build, run it locally and include generated `wwwroot/` content. Exclude `node_modules/`.

## Example output to surface to the user

```text
Detected: ASP.NET Core web app (net10.0)
Web project: src/Web/Web.csproj
Archive root: solution root (includes referenced projects)
Runtime: DOTNETCORE:10.0; startup is automatic.
```
