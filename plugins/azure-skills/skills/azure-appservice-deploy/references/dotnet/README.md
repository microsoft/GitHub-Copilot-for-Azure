# .NET

- [Select the web project and archive root](detect.md). Support ASP.NET Core, MVC, Web API and server-hosted Blazor; not .NET Framework or standalone WASM.
- Discover Linux runtimes with `az webapp list-runtimes --os linux --runtime dotnet -o json`. Select `DOTNETCORE:<version>` matching `TargetFramework` and user constraints. Don't silently retarget.
- [Use App Service's default startup](startup-commands.md) unless the published assembly needs an explicit `dotnet <Assembly>.dll` command.
- CLI: ZIP source with all project references; exclude `bin`, `obj`, local secrets and stale archives. Enable Oryx source build, using relative `PROJECT` for multi-project archives.
- azd: verify `language: dotnet` (or `csharp`/`fsharp`), the selected web project path, and a local SDK matching `TargetFramework` and `global.json`. azd runs `dotnet publish` locally; do not enable Oryx or upload a source ZIP.
