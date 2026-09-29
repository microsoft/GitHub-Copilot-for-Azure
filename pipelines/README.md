# Azure DevOps pipelines

## Telemetry reporter nightly build

[`telemetry-reporter-nightly.yml`](telemetry-reporter-nightly.yml) defines the
nightly Native AOT build for `ghcfa-telem`. The pipeline is hosted in the
`azure-sdk/internal` Azure DevOps project and uses the 1ES official pipeline
template and Azure SDK build pools.

Pipeline: [telemetry-reporter - nightly](https://dev.azure.com/azure-sdk/internal/_build?definitionId=8402)

Scheduled runs have three stages:

1. **Initialize** finds the previous scheduled run that succeeded or succeeded
   with warnings, checks whether executable-affecting telemetry reporter files
   changed, and creates the platform matrices.
2. **Build** produces packages for `win-x64`, `win-arm64`, `osx-x64`,
   `osx-arm64`, `linux-x64`, and `linux-arm64`.
3. **Verify** validates every SHA-256 sidecar and publishes a build manifest
   with the run reason.

Manually queued runs of `main` add a fourth **Release** stage after verification.
That stage retains the current run, authenticates with GitHub, and publishes the
artifacts produced by the preceding Build stage.

Build jobs authenticate to the Azure SDK public NuGet feed and use
[`../telemetry-reporter/nuget.config`](../telemetry-reporter/nuget.config)
so dependency restore remains inside the 1ES network boundary.

The YAML schedule runs from `main` at 06:00 UTC. Manual runs always build and
verify the full matrix. Scheduled runs skip the Build and Verify stages when
changes are limited to unrelated, documentation, release automation, or test
files. Manually queued runs from branches other than `main` build and verify but
do not include the Release stage.

Each RID has an artifact named `telemetry-reporter_<rid>` containing runtime
and symbol ZIP files plus checksums. `telemetry-reporter_manifest` records the
source build ID, source commit, NBGV version, release tag, files, and hashes.

## Telemetry reporter release

Queue the `telemetry-reporter - nightly` pipeline manually from `main` to create
a release. The same run builds and verifies all six packages before entering the
Release stage, so the release commit and artifacts cannot drift between pipeline
runs.

The Release stage follows the Azure SDK release pattern:

1. Download the manifest and six platform artifacts produced earlier in the
   current run.
2. Retain the current run for 731 days.
3. Authenticate with the Azure SDK Automation GitHub App through
   `AzureSDKEngKeyVault Secrets`.
4. Validate that the manifest represents the current manual run and matches its
   build ID and source commit.
5. Create a draft GitHub release tagged `ghcfa-telem-<version>`, upload the six
   runtime ZIPs, and publish it as the normal Latest release. Failed uploads or
   publication delete the draft and tag so the pipeline can be retried.

Symbols, checksums, build information, and the manifest remain Azure DevOps
artifacts on the retained release run. A repeated release for the same computed
version fails rather than replacing an existing release or its assets.

The registered nightly definition uses this repository as its GitHub source
and this YAML path:

```text
pipelines/telemetry-reporter-nightly.yml
```

The nightly pipeline is authorized to use `1ESPipelineTemplates`,
`azsdk-pool`, `azsdk-pool-arm64`, the Azure Pipelines macOS pool, and the build
service identity's read access to prior builds. Its initializer maps
`System.AccessToken` so scheduled change detection can query the Builds API.

The pipeline also requires permission to create retention leases for its runs
and use the `AzureSDKEngKeyVault Secrets` service connection. The Azure SDK
Automation GitHub App must have release and tag write access to
`microsoft/GitHub-Copilot-for-Azure`.
