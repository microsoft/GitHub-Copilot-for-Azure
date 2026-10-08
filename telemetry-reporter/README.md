# ghcfa-telem

`ghcfa-telem` is a stripped-down .NET implementation of the Azure MCP
`server plugin-telemetry` command. It produces an executable named
`ghcfa-telem` and embeds telemetry allowlist resources from `resources\`.

## Allowlist maintenance

The [allowlist synchronization workflow](../.github/workflows/sync-to-azure-mcp.yml)
runs on weekdays or by manual dispatch. It generates `allowed-skill-names.json`
and `allowed-plugin-file-references.json` once from this repository's plugin
sources, then proposes separate PRs in `microsoft/mcp` and this repository.
Here, those PRs update only the two files under `telemetry-reporter/resources/`.
Unchanged lists produce no commit or PR; subsequent changes reuse the open PR
on the destination's stable bot-owned branch. Either destination can succeed
independently of the other.

The workflow uses `GHCP4A_BOT_APP_ID` and `GHCP4A_BOT_PRIVATE_KEY`. The GitHub
App must be installed on both repositories with Contents and Pull requests
write access; each job requests a token scoped to its destination. App tokens
allow the resulting PRs to trigger normal validation workflows.

`allowed-tool-names.json` remains a pinned Azure MCP snapshot, as do the runtime
compatibility values in `CompatibilityConstants`. Generating the skill and
reference lists does not upgrade that source revision or synchronize tool names.
Tool-name synchronization is tracked separately in
[microsoft/GitHub-Copilot-for-Azure-pr#393](https://github.com/microsoft/GitHub-Copilot-for-Azure-pr/issues/393).

Merging an allowlist PR updates the resources embedded by subsequent reporter
builds, but does not publish a new reporter release. This only partially
addresses
[microsoft/GitHub-Copilot-for-Azure-pr#390](https://github.com/microsoft/GitHub-Copilot-for-Azure-pr/issues/390);
the reporter build and release processes remain unchanged.

## Telemetry policy

Distributed release builds send telemetry only to the Microsoft-owned
Application Insights destination. Set `AZURE_MCP_COLLECT_TELEMETRY=false` to
disable telemetry collection.

User-provided Application Insights connection strings and OTLP exporters are
not supported. This Microsoft-only exporter policy intentionally differs from
Azure MCP while preserving its telemetry events, properties, and global
opt-out behavior.

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

Telemetry reports the reporter's full NBGV informational version, including
commit metadata, in the event's `Version` property, the OpenTelemetry
`service.version` resource attribute, and the activity-source version.
The event's `McpServerNameV2` property identifies the executable as `ghcfa-telem`.
The activity-source name remains `Azure.Mcp.Server`, and the OpenTelemetry
service name remains `azmcp`.
`CompatibilityConstants.AzureMcpCommit` separately pins the Azure MCP source
revision used for implementation and allowlist synchronization.

## Native AOT builds

Native AOT publishing is opt-in and supports Azure MCP's standard operating
system and architecture matrix, plus two musl Linux targets:

| Build host | Target RIDs | Smoke tests |
|---|---|---|
| Windows x64 | `win-x64`, `win-arm64` | `win-x64` only |
| glibc Linux x64 | `linux-x64`, `linux-musl-x64` | Both; musl runs in Alpine |
| glibc Linux ARM64 | `linux-arm64`, `linux-musl-arm64` | Both; musl runs in Alpine |
| macOS x64 | `osx-x64`, `osx-arm64` | `osx-x64` only |

Native AOT supports cross-architecture publishing within an operating system,
but not cross-operating-system publishing. The build script follows Azure
MCP's host topology: Windows and macOS ARM64 artifacts are cross-compiled on
x64 hosts, while Linux ARM64 builds run on an ARM64 host. Musl targets are
compiled inside matching-architecture Alpine containers, not cross-linked
against the glibc host's libraries. Cross-architecture emulation is not
supported.

### Prerequisites

All platforms require:

- .NET 10 SDK (provided by the Alpine build image for musl targets)
- PowerShell 7 or later

Platform-specific prerequisites:

- Windows: Visual Studio with the **Desktop development with C++** workload, a
  Windows SDK, and the MSVC x64/x86 build tools. Building `win-arm64` also
  requires the MSVC ARM64 build tools.
- Linux: `clang`, `binutils` (including `objcopy`), and zlib development
  headers for glibc targets. Run ARM64 builds on an ARM64 host.
- Musl Linux: a glibc Linux host with PowerShell 7 and a running Linux Docker
  engine of the same architecture. Use a full clone with `.git` inside the
  checkout, rather than a linked worktree, so NBGV can read the complete
  history inside the container. The
  [toolchain Dockerfile](eng/native-musl/Dockerfile) uses the exact .NET SDK
  version from `global.json` on Alpine 3.23 and installs `clang`, `build-base`,
  `musl-dev`, `binutils`, and `zlib-dev`. The resulting binaries target
  Alpine 3.23 or compatible newer musl environments. No Alpine PowerShell
  installation is required.
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
   when the target RID matches the host RID, or inside Alpine for musl targets.
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

For musl targets, run from `telemetry-reporter` on the matching glibc Linux
host. In Bash:

```bash
# x64 host
pwsh ./eng/scripts/Build-Native.ps1 -RuntimeIdentifier linux-musl-x64 -RestoreConfigFile ./nuget.public.config
# ARM64 host
pwsh ./eng/scripts/Build-Native.ps1 -RuntimeIdentifier linux-musl-arm64 -RestoreConfigFile ./nuget.public.config
```

In PowerShell on those Linux hosts:

```powershell
./eng/scripts/Build-Native.ps1 -RuntimeIdentifier linux-musl-x64 -RestoreConfigFile ./nuget.public.config
./eng/scripts/Build-Native.ps1 -RuntimeIdentifier linux-musl-arm64 -RestoreConfigFile ./nuget.public.config
```

The script builds the toolchain image locally unless `-MuslBuildImage` supplies
an image built from the same Dockerfile and SDK version. It checks the container
RID and compiles, links, executes, and extracts symbols from a musl/zlib probe
before publishing. Official CI builds the toolchain image with the 1ES container
task and uses the existing Azure SDK NuGet feed. Its `NuGetAuthenticate` access
token is forwarded through a temporary, feed-scoped environment variable, not
command-line credentials or a credential file. This permits restoring musl
packages that have not yet been cached by the feed. Public GitHub CI and the
local examples explicitly select [nuget.public.config](nuget.public.config)
instead; official builds never fall back to nuget.org.

Musl executable smoke tests run in the matching Alpine `runtime-deps` image,
without the SDK or compiler libraries. All executions disable telemetry.

Use `-NoClean` to skip `dotnet clean`, or select a different artifact root:

```powershell
.\eng\scripts\Build-Native.ps1 -RuntimeIdentifier win-x64 -NoClean -OutputRoot C:\temp\ghcfa-telem
```

Test a locally produced runtime ZIP against the shared hook installer:

```powershell
.\eng\scripts\Test-LocalTelemetryInstall.ps1 `
  -ZipPath .\artifacts\packages\ghcfa-telem-0.1.0-win-x64.zip `
  -Version 0.1.0
```

On Linux or macOS, invoke the same PowerShell script through `pwsh` and pass
the matching runtime ZIP:

```bash
pwsh ./eng/scripts/Test-LocalTelemetryInstall.ps1 \
  -ZipPath ./artifacts/packages/ghcfa-telem-0.1.0-linux-x64.zip \
  -Version 0.1.0
```

The test uses an isolated cache, verifies that a second install reuses the
cached executable without reading the ZIP again, runs the installed executable
with `--help`, and removes the cache afterward. Pass `-KeepCache` to retain the
installed files for inspection.

Test the complete PowerShell hook path with the same local runtime ZIP:

```powershell
.\eng\scripts\Test-LocalTelemetryHook.ps1 `
  -ZipPath .\artifacts\packages\ghcfa-telem-0.1.0-win-x64.zip `
  -AllowTelemetry
```

On Linux or macOS:

```bash
pwsh ./eng/scripts/Test-LocalTelemetryHook.ps1 \
  -ZipPath ./artifacts/packages/ghcfa-telem-0.1.0-linux-x64.zip \
  -AllowTelemetry
```

This test copies the shared hooks and a test plugin manifest into an isolated
directory, enables the standalone publisher and local ZIP override, invokes a
session-start hook, and verifies the hook protocol response, reporter
installation, telemetry arguments, and reporter exit status. A successful
end-to-end test sends one test event to the reporter's Microsoft-owned
Application Insights destination, so the script requires `-AllowTelemetry`.
Pass `-KeepArtifacts` to retain the temporary plugin, logs, and installed
executable.

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

## Nightly builds

The [GitHub Actions workflow](../.github/workflows/telemetry-reporter-build.yml)
also builds both musl targets on native Linux x64 and ARM64 runners for pull
requests. It runs the same packaging and executable
smoke tests, and uploads verified runtime and symbols packages without creating
a release.

The Azure DevOps pipeline defined in
[`pipelines/telemetry-reporter-nightly.yml`](../pipelines/telemetry-reporter-nightly.yml)
runs nightly in the `azure-sdk/internal` project. It uses the 1ES official
pipeline template and Azure SDK build pools to produce all eight supported Native
AOT packages:

[Open the telemetry reporter nightly pipeline](https://dev.azure.com/azure-sdk/internal/_build?definitionId=8402).

- `win-x64` and `win-arm64`
- `osx-x64` and `osx-arm64`
- `linux-x64` and `linux-arm64`
- `linux-musl-x64` and `linux-musl-arm64`

Scheduled runs compare `main` with the previous scheduled build that succeeded
or succeeded with warnings, and skip the platform matrix when no
executable-affecting telemetry reporter files changed. Manual runs always build
and verify the complete matrix.

Each target publishes a `telemetry-reporter_<rid>` pipeline artifact containing
the runtime ZIP, symbols ZIP, and their SHA-256 sidecars. A final
`telemetry-reporter_manifest` artifact records and verifies the complete
eight-target build, including the source build ID, run reason, source commit, and
release tag.

## GitHub releases

Queue
[`pipelines/telemetry-reporter-nightly.yml`](../pipelines/telemetry-reporter-nightly.yml)
manually from `main` to create a release. The manual run builds and verifies the
complete matrix, then waits for authorized approval through the protected
`package-publish` Azure DevOps environment before retaining itself and
publishing those same artifacts. This keeps the release commit and packages
within one pipeline run.

It creates a normal
[GitHub release](https://github.com/microsoft/GitHub-Copilot-for-Azure/releases)
tagged `ghcfa-telem-<version>` and titled `ghcfa-telem <version>`. The release
targets the manual run's source commit, is marked Latest, and contains the eight
runtime ZIPs. Symbols, checksums, build information, and the manifest remain
available from the retained release run.

Pipeline restores use the Azure SDK public NuGet feed instead of direct
`nuget.org` access, keeping dependency acquisition within the 1ES network
boundary.

Runtime archives are checked for executable presence and symbol exclusion.
Symbols archives must contain the platform's native debug artifact and no
runtime files. Release validation checks both archive types against the
manifest and their SHA-256 sidecars before uploading the runtime assets.
