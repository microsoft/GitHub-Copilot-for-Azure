# ghcfa-telem

`ghcfa-telem` is a stripped-down .NET implementation of the Azure MCP
`server plugin-telemetry` command. It produces an executable named
`ghcfa-telem` and consumes pinned Azure MCP allowlist resources from
`resources\`.

## .NET standard build

The normal build remains framework-dependent:

```powershell
dotnet build .\ghcfa-telem.slnx --configuration Release
```

## Versioning

[Nerdbank.GitVersioning](https://github.com/dotnet/Nerdbank.GitVersioning)
calculates the executable and library versions from `version.json`. The
starting major and minor version is `0.1`, and `pathFilters: ["."]` limits
version-height changes to commits that modify this directory.

## Windows x64 Native AOT build

Native AOT publishing is opt-in and currently supports Windows x64 only.

### Prerequisites

- .NET 10 SDK
- Visual Studio with the **Desktop development with C++** workload
- MSVC x64/x86 build tools
- A Windows SDK
- PowerShell 7 or later

### Build and package

Run the build script from the `telemetry-reporter` directory:

```powershell
.\eng\scripts\Build-Native.ps1
```

The script:

1. Finds a complete Visual Studio C++ x64 toolchain.
2. Initializes `vcvars64.bat`.
3. Publishes the console app with `BuildNative=true`.
4. Runs the native executable through success and validation-error smoke tests.
5. Creates separate runtime and symbols packages.

Use `-NoClean` to skip `dotnet clean`, or select a different artifact root:

```powershell
.\eng\scripts\Build-Native.ps1 -NoClean -OutputRoot C:\temp\ghcfa-telem
```

### Direct publish

From a Visual Studio Developer PowerShell or another shell where the MSVC x64
environment is already initialized:

```powershell
dotnet publish .\src\ghcfa-telem\ghcfa-telem.csproj `
  --configuration Release `
  --runtime win-x64 `
  --self-contained true `
  -p:BuildNative=true
```

Normal Debug and Release builds do not use Native AOT unless
`BuildNative=true` is supplied.

Native builds use invariant globalization and framework resource keys to
reduce binary size. Culture-specific formatting and localized framework
exception messages are therefore unavailable in the native executable.

### Artifacts

The default output is:

```text
artifacts\
  publish\win-x64\
  packages\
    ghcfa-telem-<version>-win-x64.zip
    ghcfa-telem-<version>-win-x64.zip.sha256
    ghcfa-telem-<version>-win-x64-symbols.zip
    ghcfa-telem-<version>-win-x64-symbols.zip.sha256
```

The runtime ZIP contains the native executable and all non-PDB runtime files
from `dotnet publish`. The symbols ZIP contains the native executable PDB and
the library PDB.

The smoke tests set `AZURE_MCP_COLLECT_TELEMETRY=false`, so building the native
artifact does not send telemetry.
