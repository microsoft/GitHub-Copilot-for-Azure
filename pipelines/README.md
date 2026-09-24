# Azure DevOps pipelines

## Telemetry reporter nightly build

[`telemetry-reporter-nightly.yml`](telemetry-reporter-nightly.yml) defines the
nightly Native AOT build for `ghcfa-telem`. The pipeline is hosted in the
`azure-sdk/internal` Azure DevOps project and uses the 1ES official pipeline
template and Azure SDK build pools.

Pipeline: [telemetry-reporter - nightly](https://dev.azure.com/azure-sdk/internal/_build?definitionId=8402)

The pipeline has three stages:

1. **Initialize** finds the previous scheduled run that succeeded or succeeded
   with warnings, checks whether executable-affecting telemetry reporter files
   changed, and creates the platform matrices.
2. **Build** produces packages for `win-x64`, `win-arm64`, `osx-x64`,
   `osx-arm64`, `linux-x64`, and `linux-arm64`.
3. **Verify** validates every SHA-256 sidecar and publishes a build manifest.

Build jobs authenticate to the Azure SDK public NuGet feed and use
[`../telemetry-reporter/nuget.config`](../telemetry-reporter/nuget.config)
so dependency restore remains inside the 1ES network boundary.

The YAML schedule runs from `main` at 06:00 UTC. Manual runs always build the
full matrix. Scheduled runs skip the Build and Verify stages when changes are
limited to unrelated, documentation, or test files.

Each RID has an artifact named `telemetry-reporter_<rid>` containing runtime
and symbol ZIP files plus checksums. `telemetry-reporter_manifest` records the
source commit, NBGV version, files, and hashes.

The registered definition uses this repository as its GitHub source and this
file as its YAML path:

```text
pipelines/telemetry-reporter-nightly.yml
```

The pipeline is authorized to use `1ESPipelineTemplates`, `azsdk-pool`,
`azsdk-pool-arm64`, the Azure Pipelines macOS pool, and the build service
identity's read access to prior builds. The initializer maps
`System.AccessToken` so scheduled change detection can query the Builds API.
