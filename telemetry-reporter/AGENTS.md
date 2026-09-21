# Telemetry Reporter Agent Guide

This directory contains a standalone .NET 10 implementation of the Azure MCP
`server plugin-telemetry` command. Read [README.md](README.md) for user-facing
build, packaging, and usage documentation. This file defines how coding agents
should modify the project.

## Scope and Structure

- `src/ghcfa-telem/` contains the console application.
- `src/Ghcfa.Telemetry/` contains command parsing, validation, telemetry, and
  platform-specific machine information behavior.
- `tests/Ghcfa.Telemetry.Tests/` contains the .NET unit tests.
- `resources/` contains Azure MCP allowlists embedded by `Ghcfa.Telemetry`.
- `eng/scripts/Build-Native.ps1` creates the opt-in Windows x64 Native AOT
  packages.

The repository-level `tests/AGENTS.md` does not apply to this directory.

## Compatibility Requirements

- Preserve the Azure MCP command-line contract, JSON response shape, exit
  codes, validation behavior, telemetry event names, and telemetry properties.
- Treat `CompatibilityConstants.AzureMcpCommit` as the source revision for the
  copied behavior and allowlists.
- When synchronizing with a newer Azure MCP revision, update the compatibility
  constants, embedded resources, implementation, tests, README, and third-party
  notices as applicable.
- Keep telemetry disabled in build or smoke-test scenarios that invoke the
  executable.
- Add XML summary comments to every declared C# type, including test and nested
  types.

## Build and Test

Run .NET commands from this directory so `global.json` selects the expected SDK
and Microsoft Testing Platform runner:

```powershell
dotnet build .\ghcfa-telem.slnx --configuration Release
dotnet test .\ghcfa-telem.slnx --configuration Release --no-build
```

Normal builds are framework-dependent. Native AOT is opt-in, Windows x64 only,
and requires the Visual Studio C++ toolchain described in the README.

## Versioning

- Nerdbank.GitVersioning is configured by `version.json` with a `0.1`
  major/minor version and `pathFilters: ["."]`.
- Do not add hard-coded `<Version>` properties to project files.
- Scripts that need the computed package version must invoke NBGV's
  `GetBuildVersion` target and read `NuGetPackageVersion`.
- Keep the NBGV package reference private and centrally versioned through
  `Directory.Packages.props`.

## Repository Integration

This project is intentionally independent of the root npm build and existing
CI workflows. Do not modify root build scripts, package manifests, or CI
configuration to include it unless the user explicitly requests that work.
