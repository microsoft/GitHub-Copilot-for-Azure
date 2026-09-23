# Azure DevOps pipelines

## Telemetry reporter nightly build

[`telemetry-reporter-nightly.yml`](telemetry-reporter-nightly.yml) defines the
nightly Native AOT build for `ghcfa-telem`. The pipeline is hosted in the
`azure-sdk/internal` Azure DevOps project and uses the 1ES official pipeline
template and Azure SDK build pools.

Pipeline: [telemetry-reporter - nightly](https://dev.azure.com/azure-sdk/internal/_build?definitionId=8402)

The pipeline has four stages:

1. **Initialize** finds the previous successful scheduled run, checks whether
   executable-affecting telemetry reporter files changed, and creates the
   platform matrices.
2. **Build** produces unsigned intermediate packages for `win-x64`,
   `win-arm64`, `osx-x64`, `osx-arm64`, `linux-x64`, and `linux-arm64`.
3. **SignAndPack** Authenticode-signs the Windows executables, Apple-signs and
   notarizes the macOS executables, passes the Linux runtime ZIPs through
   byte-for-byte unsigned, and rebuilds the signed final packages and checksums.
4. **Verify** validates Windows and macOS signatures on native hosts, validates
   every SHA-256 sidecar, and publishes a build manifest.

Build jobs authenticate to the Azure SDK public NuGet feed and use
[`../telemetry-reporter/nuget.config`](../telemetry-reporter/nuget.config)
so dependency restore remains inside the 1ES network boundary.

The YAML schedule runs from `main` at 06:00 UTC. Manual runs always build the
full matrix. Scheduled runs skip the Build and Verify stages when changes are
limited to unrelated, documentation, or test files.

Build jobs publish intermediate artifacts named
`telemetry-reporter_unsigned_<rid>`. These artifacts are inputs to signing and
are not the distributable output. The signing stage publishes the final
`telemetry-reporter_<rid>` artifacts containing runtime and symbol ZIP files
plus checksums. `telemetry-reporter_manifest` records the source commit, NBGV
version, files, and final post-signing hashes.

The signing stage follows the Azure MCP pipeline pattern. It uses a pinned
`internal/azure-sdk-build-tools` resource, signing key `CP-230012`, and the
build-tools Windows binary and macOS CLI signing templates. macOS executables
are staged with the telemetry reporter entitlements file before hosted signing.
Signing failures stop the pipeline; there is no unsigned fallback.

The registered definition uses this repository as its GitHub source and this
file as its YAML path:

```text
pipelines/telemetry-reporter-nightly.yml
```

The pipeline is authorized to use `1ESPipelineTemplates`, the pinned
`internal/azure-sdk-build-tools` repository, `azsdk-pool`,
`azsdk-pool-arm64`, the Azure Pipelines macOS pool, the Azure SDK signing
services, and the build service identity's read access to prior builds. The
initializer maps `System.AccessToken` so scheduled change detection can query
the Builds API.
