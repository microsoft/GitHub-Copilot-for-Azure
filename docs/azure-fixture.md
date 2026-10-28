# Azure fixture in integration tests

## Background

Some skills are designed to operate on existing Azure resources. For example,

- azure
    - azure-resource-lookup
    - azure-resource-visualizer
    - azure-cost
    - azure-compliance
    - azure-kusto
    - azure-diagnostics
    - azure-reliability
- azure-kusto-graph-skills
  - azure-kusto-graph
  - azure-kust-irql
  - azure-kusto-irql-graph

To meaningfully evaluate their scenarios, we need to prepare Azure resources for them and see how an Agent operates the resources with the skill.

## Fixture persistence levels

All Azure fixtures use the same manifest schema and provisioning logic, whether provisioned for an individual stimulus or by a workflow. Their lifecycle is determined by the manifest's `persistence` policy, not by where they are used:

- `never` (default): Always provision a fresh fixture. The Vally executor deletes it after the test; a `DeleteAfter` tag also marks it for external cleanup after 3 hours.
- `temporary`: Reuse a complete fixture instance across tests and concurrent workflow runs, or provision one if none is eligible. Its `DeleteAfter` tag is fixed at 24 hours from the start of provisioning, and deletion is left to external cleanup.
- `permanent`: Reuse a complete fixture matching the manifest ID and version, or provision one if none exists. Newly provisioned resource groups are tagged with `DoNotDelete=True` to protect them from external cleanup.

The manifest's `type` (`readOnly` or `readWrite`) describes whether the agent task is expected to modify resource data; it does not control persistence or enforce access restrictions. Reusing fixtures can reduce provisioning cost and transient environmental failures, but even a task marked `readOnly` may modify resources. Inspect reused fixtures when investigating unexpected evaluation results.

## Evaluation setup

The setup has two shared scripts as entry points:

- A provision-fixture script that exports `await provision(manifestPath, manifest)` for both stimuli and workflow fixtures, using the shared `FixtureManifest` type.
- A cleanup script that can delete fixtures defined by a manifest. This is reserved for devs to clean up the stale fixtures manually. The vally executor uses the same underlying logic to clean up non-persistent fixtures after each test.

### Stimuli fixture

A test case (Vally stimulus) defines its Azure fixtures with the following files:

- A `manifest.json` file, called the "manifest" below. The stimuli fixture's manifest file is usually placed in the `fixture/` directory next to the stimuli's yaml definition.
- Zero or more `.bicep` templates. Each template is written at resource group scope.
- An `azureFixture` tag in the stimulus containing the path to the manifest, relative to the stimulus file.

The dynamically generated resource context of stimuli fixtures are automatically injected to the first user prompt of the stimuli.

### Workflow fixture

A workflow defines its Azure fixtures with the following files:

- A `manifest.json` file, called the "manifest" below. Stimuli fixture and workflow fixture share the same manifest schema. The workflow fixture's manifest file is usually placed in the `fixture/` directory next to the workflow's yaml definition.
- Zero or more `.bicep` templates. Each template is written at resource group scope.
- An early step in the workflow that programmatically imports the provision-fixture script and calls the helper function with its manifest.

The dynamically generated resource context of workflow fixture must be explicitly exported from the step that provisions it (e.g. running vally eval suites with the fixture data), if later steps needs to the resource context (e.g. inject to test prompts).

Workflow fixture provisioning implemented fixture sharing so that concurrent runs that depend on the same fixture reuse an complete instance of the fixture. See the [Fixture Sharing](#fixture-sharing) section for more details.

### Manifest

The manifest contains the information needed to support the following tasks:

1. Find provisioned fixtures (if needed)
2. Provision new fixtures
3. Compute the context prompt to send to the LLM to scope its operations

The "provision-fixture" script is responsible for these tasks. The vally executor will use its output when running the integration test.

A manifest has a `schemaVersion`. It must be bumped whenever the manifest schema receives a breaking change. It's not used by the workflow but reserved for human maintainers to track schema changes.

A manifest has a required `id`. It is a stable identifier for the complete fixture described by the manifest, across all of its Bicep configs. Every resource group provisioned for either a stimuli fixture or a workflow fixture is tagged with `ManifestId=<id>`. Keep the value unchanged when updating the same fixture; use a different value for a distinct fixture.

Every newly provisioned resource group also receives `FixtureInstanceId=<runId>`, using a random UUID generated for that provisioning run. All resource groups created in the same run share this value; fresh provisioning runs generate new values. Reusing an existing fixture preserves its original instance tag.

A manifest has a version. It must be bumped whenever the underlying fixture definition is updated and must be provisioned again. Provisioned fixtures have a tag containing this version number to support the detection of stale fixtures. The computed resource group names include the version number, so a script run with an updated manifest will provision new fixtures even if there are stale fixtures with a lower version.

A manifest has a type indicating whether the fixture is `readOnly` or `readWrite`. This is currently used only to help readers quickly understand how the fixture will be used. The provision script does not use it right now.

A manifest has an optional `persistence` policy, independent of whether a stimulus or workflow uses it:

| Policy | Discovery | Retention |
|--------|-----------|-----------|
| `never` (default) | Skips discovery; always provisions a fresh fixture | `DeleteAfter` in 3 hours |
| `temporary` | Uses blob-lease coordination to select a complete instance or provision a new one | Fixed `DeleteAfter` in 24 hours |
| `permanent` | Finds completed resource groups by fixture ID and version; rejects partial or duplicate fixtures | New groups have `DoNotDelete=True` |

The Vally executor deletes only `never` fixtures after each test. Temporary fixtures are left for external cleanup; permanent fixtures are protected from it.
Temporary fixtures run post-provision scripts only when creating a new instance, before marking it complete. The other policies retain stimuli behavior: post-provision scripts run on every invocation, including permanent fixture reuse.

Each temporary instance receives a fixed `DeleteAfter` deadline 24 hours from the start of provisioning, shared by all its resource groups. Neither provisioning completion nor reuse extends it. The coordination blob's `expiresAt` is the earliest component `DeleteAfter` minus one hour. Both recorded reuse and discovery exclude instances with any component at or inside that one-hour safety margin, or with a missing or malformed expiration. If no eligible instance remains, new callers provision a replacement, leaving old instances for external cleanup. This margin reduces cleanup-boundary races but does not coordinate with cleanup already in progress.

A manifest has a description. It is human-readable text that explains in natural language what the manifest contains.

A manifest has an array of Bicep configs. Each config creates one resource group and can optionally map to a Bicep template that is provisioned into it. See the dedicated Bicep config section for more information.

A manifest has an optional `postProvisionScript` script. The `postProvisionScript` script must be a self-contained TypeScript script that runs through `tsx`. When we run this script, we pass the provisioned resource group names to it as command-line arguments. One purpose of the `postProvisionScript` script is to support data-plane operations that cannot be expressed in Bicep. Another purpose is to perform operation to persistent fixture.

A manifest has an optional `postTestScript` script. The `postTestScript` script must be a self-contained TypeScript script that runs through `tsx`. When we run this script, we pass the provisioned resource group names to it as command-line arguments. One purpose of the `postTestScript` script is to perform operations to a persistent resource for cost saving purposes. For example, if we have a persistent Kusto Cluster as the test fixture, we the `postTestScript` script can stop it after the test finishes.

### Bicep config

A fresh provisioning task for each Bicep config creates a resource group. When the config declares a Bicep template, it also deploys the template's Azure resources into that group.

A Bicep config has a required `fixtureId`. It uniquely identifies the resource group and all its child resources. Provisioned fixtures have a tag containing the `fixtureId` so they can be programmatically searched.

A Bicep config has an optional `path`. It is the path to the Bicep template that defines resources to provision in the resource group, relative to the location of the manifest. When omitted, provisioning creates and tags only the resource group.

A Bicep config has a required `location`. It determines the Azure location, such as `eastus`, in which to create the resource group and provision its child resources.

A Bicep config has a required `resourceGroupNameBase`. This text provides the recognizable portion of the resource group name. The complete resource group name is computed for each run.

A Bicep config with a `path` has an optional `parameters` array. This array provides parameter values to pass to the Bicep template during provisioning. The author can define parameters with explicit values, which are passed as is, or define substitution parameters (for example, known keys without values), which resolve to values at provisioning time. The provision-fixture script supports a predefined set of substitution parameters. Parameters are invalid when `path` is omitted.

### Provision-fixture script

The provision-fixture script manages the provisioning of a new fixture instance.

#### Context

The script maintains a "context." The context contains metadata about the script run and precomputed values that can be used as substitution parameters.

- `runId`: a unique random UUID for the run
- `suffix`: a randomly generated suffix for resource group names
- `subscriptionId`: the subscription ID of the test subscription
- `tenantId`: the tenant ID of the test subscription
- `resourceGroupNames`: the resource group names computed for this run
- `testPrincipalId`: the principal ID of the test principal. For CI runs, this is the managed identity. For local runs, this is the user principal.

The context is computed at the beginning of the script run.

#### Provisioning

The script iterates through all the Bicep configs and provisions each one sequentially.

##### Non-persistent (`persistence: "never"`)

By default, fixtures are not persisted. Every new run provisions a fresh fixture. A random suffix is appended to the actual resource group names so that concurrent script runs don't run into name collision.

For each Bicep config:

1. Provision the fixture.

The script first creates the target resource group by using the Azure CLI. The command uses the computed resource group name and adds the following tags:

- `FixtureId={fixtureId of the Bicep config}`
- `FixtureVersion={version of the manifest}`
- `FixtureInstanceId={runId of the provisioning run}`
- `DeleteAfter={3 hours after the current time}`, so the cleanup script can delete the resource group
- `Completed=False`, indicating the provision hasn't finished yet

It then uses the Azure CLI to deploy the Bicep template to this resource group. All declared parameters are resolved before the Azure CLI is invoked and are passed to the Bicep template.

After all the Bicep templates are provisioned, the script uses Azure CLI to update the `Completed=False` tag to `Completed=True` indicating the provision has completed.

The Vally executor attempts to delete the provisioned fixtures after the test finishes.

##### Permanent (`persistence: "permanent"`)

Persistent fixtures are explicitly declared to be persistent in their manifests. When the provision-fixture script sees a persistent manifest. It expects none of its resources have been provisioned or all the resources to have been provisioned already.

It first discovers provisioned fixtures by searching for resource groups with matching `fixtureId`+`fixtureVersion` and the `Completed=True` tag. If it find partially provisioned fixtures, the script will report an error and exit. If it finds more than one fixture for each fixtureId, the script will report an error and exit.

If it finds no provisioned fixture, it will start provisioning the Bicep templates sequentially like the non-persistent case, except that it will set the tag to make the clean up workflow skip them:

- `DoNotDelete=True`

The Vally executor will not attempt to delete the persistent fixtures after the test finishes.

> Note: the author understands that two concurrent runs of the provision script may race and generate more than one instance of the persistent resources. The chance of such race condition is considered low. Maintainers of the test subscription will monitor when it happens and manually resolve the conflicts.

If it finds all the provisioned fixture, it will present them to the test as if they were provisioned in this run.

#### Output

The async `provision(manifestPath, manifest)` function returns the run context and a JSON output string containing `resourceGroups`. Temporary fixtures also include `fixtureId`, `fixtureVersion`, `fixtureInstanceId`, and `resourceGroupIdsByComponent` for downstream workflow steps.

#### PostProvision script

After provisioning all the Bicep configs, the script executes each `postProvisionScript` script by using `tsx`.

The `postProvision` script can be used for these purposes:

- Perform data-plane operations not supported by Bicep. For example, upload a blob to a blob container.
- Perform a readiness check. For example, RBAC changes may take time to propagate. If this frequently happens for a test case, we can introduce an artificial delay or continue polling until certain conditions are met.
- Perform operation on persistent fixture to make it ready for testing (e.g. start a stopped Kusto Cluster).

#### PostTest script

This script is run after the test finishes.

The `postProvision` script can be used for these purposes:

- Perform data-plane operations not supported by Bicep. For example, upload a blob to a blob container.
- Perform a readiness check. For example, RBAC changes may take time to propagate. If this frequently happens for a test case, we can introduce an artificial delay or continue polling until certain conditions are met.

### Executor injecting fixture context

Our custom Vally executor runs the provision script if an `azureFixture` tag is present. If the provision script completes with an exit code of 0, the executor proceeds to run the test. For test cases that define an Azure fixture, the executor can read the provision script's `stdout` and inject additional context into the test run.

The injected context will be appended to the first user prompt with the following content:

- Instruction: "limit your operation to the following resource group(s)"
- Data: {the resource groups to use as the fixture}

The original user prompt in the stimulus must not provide conflicting information. Most existing integration tests do not provide a resource scope. Some must be rewritten to remove resource scopes and delegate scoping to the fixture.

### Time budget

The provision script must finish within 10 minutes. If it does not, it is aborted with a non-zero exit code. The time budget for tests that require an Azure fixture must account for provisioning time.

Each `provision()` invocation owns an isolated budget shared by its Azure CLI commands and post-provision script. Concurrent or later invocations cannot reset or exhaust another invocation's budget. Temporary fixtures have a separate lease-acquisition phase; their 10-minute provisioning budget starts after acquiring the lease. Cleanup commands and post-test scripts do not consume the provisioning budget.

### Error handling

The provisioning script will exit with a non-zero exit code if it encounters any non-recoverable error.

Our custom Vally executor runs the provisioning script before running the test. If the script exits with a non-zero exit code, the executor aborts the test run and reports the error.

## Fixture Sharing

Fixtures with `persistence: "temporary"` support fixture sharing by coordinating isolated runs using an Azure Storage Blob. Before a run starts provisioning the fixture, it must acquire the lease of a blob associated with the fixture to "optimistically" obtain the exclusive ownership of the fixture creation. If a run sees an active lease on the blob, it can assume that another run is provisioning the fixture so it can wait until the fixture is ready. The run that holds the lease must keep renewing it in the background. If the run that holds the lease crashes, the lease it held will expire so other runs can make progress.

Explicit renewal and release requests must receive an acknowledgement from the lease worker within 30 seconds. A timeout marks the renewer unhealthy, rejects all pending requests, and terminates the unresponsive worker so provisioning and cleanup cannot wait indefinitely.

Each `ResourceLock` receives a fixed absolute acquisition deadline when constructed. All `acquire()` calls on that lock share the deadline, so releasing and retrying does not reset the acquisition budget.

The locking mechanism is optimistic and doesn't guarantee exclusive ownership of the fixture creation. In certain scenarios, concurrent runs can still create more than one instances of the fixture. The locking mechanism aims at guaranteeing that each workflow run will use a complete instance of the fixture while reusing existing fixtures as much as possible.

## Operation notes

### Stimuli fixture

The following operations use this process:

1. Add fixture to a test case

- Design a fixture that can be represented by Bicep
- Write the manifest and the Bicep templates
- Write the `postProvision`, `postTest` scripts as needed.
- Write the test prompt that doesn't conflict with the fixture context
- Add the azureFixture tag to tell the custom executor to provision the fixtures

The user must be aware that fixture context is injected so that they do not provide conflicting instructions in the original test prompt. Replicating the correct context information should be harmless.

2. Update fixture for a test case

- Modify the manifest and Bicep templates
- Bump the version of the manifest
- Clean up the stale fixtures with the old version, if the fixture is persistent

Future runs of the provision script will provision the updated version of the fixture.

3. Remove a test case

- Use the cleanup script with the manifest to delete all resource groups with matching `fixtureId` and values.
- Remove the test case and all the files for its fixtures.

### Workflow fixture

1. Add a fixture to an existing workflow

- Create the manifest and Bicep templates
- Add to an early step to run the provision script with the manifest
- Funnel the output to the downstream steps, if need

2. Update fixture to an existing workflow

- Update the manifest and Bicep templates
- Bump the version of the manifest

Future runs of the provision script will provision the updated version of the fixture. Stale fixtures will be deleted by a automated clean up workflow.

3. Remove a workflow

- Use the cleanup script with the manifest to delete all resource groups with matching `fixtureId` and values.
- Remove the workflow and all the fixture manifests that are no longer used.

## References

- [vally-eval](./.github/skills/vally-eval/)
- [vally-executor](./tests/vally/vally-executor.ts)
- [nightly-integration-test](./.github/workflows/test-all-integration.yml)
