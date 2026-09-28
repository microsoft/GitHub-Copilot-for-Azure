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
3. **Verify** validates every SHA-256 sidecar, publishes a build manifest with
   the run reason, and tags successful changed scheduled runs with
   `telemetry-reporter-release-candidate`.

Build jobs authenticate to the Azure SDK public NuGet feed and use
[`../telemetry-reporter/nuget.config`](../telemetry-reporter/nuget.config)
so dependency restore remains inside the 1ES network boundary.

The YAML schedule runs from `main` at 06:00 UTC. Manual runs always build and
verify the full matrix but are not tagged as release candidates. Scheduled runs
skip the Build and Verify stages when changes are limited to unrelated,
documentation, release automation, or test files.

Each RID has an artifact named `telemetry-reporter_<rid>` containing runtime
and symbol ZIP files plus checksums. `telemetry-reporter_manifest` records the
source build ID, source commit, NBGV version, release tag, files, and hashes.

## Telemetry reporter release

[`telemetry-reporter-release.yml`](telemetry-reporter-release.yml) defines a
separate, manually queued release pipeline. Its pipeline resource selects the
latest successful `main` run of `telemetry-reporter - nightly` carrying the
`telemetry-reporter-release-candidate` tag, so skipped scheduled runs and
manually queued nightly builds cannot become the default release input.

The release job follows the Azure MCP public-release pattern:

1. Download the manifest and six platform artifacts from the selected nightly
   run.
2. Retain that source nightly run for 731 days.
3. Authenticate with the Azure SDK Automation GitHub App through
   `AzureSDKEngKeyVault Secrets`.
4. Validate that the downloaded manifest represents a scheduled run and that
   its build ID and source commit match the selected pipeline resource.
5. Create a draft GitHub release tagged `ghcfa-telem-<version>`, upload the six
   runtime ZIPs, and publish it as the normal Latest release. Failed uploads or
   publication delete the draft and tag so the pipeline can be retried.

Symbols, checksums, build information, and the manifest remain Azure DevOps
artifacts on the retained nightly run. A repeated release for the same computed
version fails rather than replacing an existing release or its assets.

The registered nightly definition uses this repository as its GitHub source
and this YAML path:

```text
pipelines/telemetry-reporter-nightly.yml
```

Register a second definition for:

```text
pipelines/telemetry-reporter-release.yml
```

The nightly pipeline is authorized to use `1ESPipelineTemplates`,
`azsdk-pool`, `azsdk-pool-arm64`, the Azure Pipelines macOS pool, and the build
service identity's read access to prior builds. Its initializer maps
`System.AccessToken` so scheduled change detection can query the Builds API.

The release pipeline additionally requires permission to read and download
artifacts from `telemetry-reporter - nightly`, create retention leases for that
run, and use the `AzureSDKEngKeyVault Secrets` service connection. The Azure
SDK Automation GitHub App must have release and tag write access to
`microsoft/GitHub-Copilot-for-Azure`.
