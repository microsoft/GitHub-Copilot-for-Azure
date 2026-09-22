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

## Native AOT builds

Native AOT publishing is opt-in and supports the same operating system and
architecture matrix as Azure MCP:

| Build host | Target RIDs | Smoke tests |
|---|---|---|
| Windows x64 | `win-x64`, `win-arm64` | `win-x64` only |
| Linux x64 | `linux-x64` | `linux-x64` |
| Linux ARM64 | `linux-arm64` | `linux-arm64` |
| macOS x64 | `osx-x64`, `osx-arm64` | `osx-x64` only |

Native AOT supports cross-architecture publishing within an operating system,
but not cross-operating-system publishing. The build script follows Azure
MCP's host topology: Windows and macOS ARM64 artifacts are cross-compiled on
x64 hosts, while Linux ARM64 builds run on an ARM64 host.

### Prerequisites

All platforms require:

- .NET 10 SDK
- PowerShell 7 or later

Platform-specific prerequisites:

- Windows: Visual Studio with the **Desktop development with C++** workload, a
  Windows SDK, and the MSVC x64/x86 build tools. Building `win-arm64` also
  requires the MSVC ARM64 build tools.
- Linux: `clang`, `binutils` (including `objcopy`), and zlib development
  headers for the target architecture. Run `linux-arm64` builds on an ARM64
  host.
- macOS: Xcode command-line tools and the macOS SDK. An x64 host can publish
  both `osx-x64` and `osx-arm64`.

### Build and package

Run the build script from the `telemetry-reporter` directory:

```powershell
.\eng\scripts\Build-Native.ps1 -RuntimeIdentifier win-x64
```

The script:

1. Validates the requested RID and host/target combination.
2. Locates and initializes the platform-native compiler and linker toolchain.
3. Publishes the console app with `BuildNative=true`.
4. Runs the native executable through success and validation-error smoke tests
   when the target RID matches the host RID.
5. Creates separate runtime and symbols packages with SHA-256 sidecars.

Specify the target RID on each host:

```powershell
# Windows x64 host
.\eng\scripts\Build-Native.ps1 -RuntimeIdentifier win-x64
.\eng\scripts\Build-Native.ps1 -RuntimeIdentifier win-arm64

# Linux x64 or ARM64 host
pwsh ./eng/scripts/Build-Native.ps1 -RuntimeIdentifier linux-x64
pwsh ./eng/scripts/Build-Native.ps1 -RuntimeIdentifier linux-arm64

# macOS x64 host
pwsh ./eng/scripts/Build-Native.ps1 -RuntimeIdentifier osx-x64
pwsh ./eng/scripts/Build-Native.ps1 -RuntimeIdentifier osx-arm64
```

The Linux commands must be run on the matching architecture. The script rejects
unsupported host/target combinations.

Use `-NoClean` to skip `dotnet clean`, or select a different artifact root:

```powershell
.\eng\scripts\Build-Native.ps1 -RuntimeIdentifier win-x64 -NoClean -OutputRoot C:\temp\ghcfa-telem
```

### Direct publish

From a shell where the target platform's Native AOT toolchain is already
initialized:

```powershell
dotnet publish .\src\ghcfa-telem\ghcfa-telem.csproj `
  --configuration Release `
  --runtime <rid> `
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
artifacts/
  publish/<rid>/
  packages/
    ghcfa-telem-<version>-<rid>.zip
    ghcfa-telem-<version>-<rid>.zip.sha256
    ghcfa-telem-<version>-<rid>-symbols.zip
    ghcfa-telem-<version>-<rid>-symbols.zip.sha256
```

The runtime ZIP contains the native executable and all non-symbol runtime files
from `dotnet publish`. The symbols ZIP contains Windows `.pdb`, Linux `.dbg`,
or macOS `.dSYM` artifacts, plus any managed PDBs emitted by the publish.

The smoke tests set `AZURE_MCP_COLLECT_TELEMETRY=false`, so building the native
artifact does not send telemetry. Cross-compiled `win-arm64` and `osx-arm64`
artifacts cannot run on their x64 build hosts, so the script explicitly reports
their smoke tests as skipped.

## Nightly Azure DevOps builds

The Azure DevOps pipeline defined in
[`pipelines/telemetry-reporter-nightly.yml`](../pipelines/telemetry-reporter-nightly.yml)
runs nightly in the `azure-sdk/internal` project. It uses the 1ES official
pipeline template and Azure SDK build pools to produce all six supported Native
AOT packages:

[Open the telemetry reporter nightly pipeline](https://dev.azure.com/azure-sdk/internal/_build?definitionId=8402).

- `win-x64` and `win-arm64`
- `osx-x64` and `osx-arm64`
- `linux-x64` and `linux-arm64`

Scheduled runs compare `main` with the previous successful scheduled build and
skip the platform matrix when no executable-affecting telemetry reporter files
changed. Manual runs always build the complete matrix.

Each target publishes a `telemetry-reporter_<rid>` pipeline artifact containing
the runtime ZIP, symbols ZIP, and their SHA-256 sidecars. A final
`telemetry-reporter_manifest` artifact records and verifies the complete
six-target build.

Pipeline restores use the Azure SDK public NuGet feed instead of direct
`nuget.org` access, keeping dependency acquisition within the 1ES network
boundary.

Musl-based Linux packages are tracked separately and are not produced by this
pipeline.
