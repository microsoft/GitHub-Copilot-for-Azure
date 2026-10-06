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

## Types of fixtures

There are two types of fixtures:

- `readOnly` fixture

For this type of fixture, the agent task reads resource data but does not modify it.

- `readWrite` fixture

For this type of fixture, the agent task reads and modifies resource data.

In theory, `readOnly` fixture can be persisted for reuse since it isn't modified to save cost and reduce the chance of getting transient failures due to environmental issues. However, there is no guarantee that the agent won't write data to it. Check the persisted fixture in case there are unexpected evaluation results. 

## Evaluation setup

### Files

A test case (Vally stimulus) defines its Azure fixtures with the following files:

- A `manifest.json` file, called the "manifest" below.
- One or more `.bicep` templates. Each template is written at resource group scope.
- An `azureFixture` tag in the stimulus containing the path to the manifest, relative to the stimulus file.

The setup uses two shared scripts:

- A provision-fixture script that handles fixture provisioning. The test running will use this script to handle fixture discovery and provisioning.
- A cleanup script that can delete fixtures defined by a manifest. This is reserved for devs to clean up the stale fixtures manually. The vally executor uses the same underlying logic to clean up non-persistent fixtures after each test.

### Manifest

The manifest contains the information needed to support the following tasks:

1. Find provisioned fixtures (if needed)
2. Provision new fixtures
3. Compute the context prompt to send to the LLM to scope its operations

The "provision-fixture" script is responsible for these tasks. The vally executor will use its output when running the integration test.

A manifest has a `schemaVersion`. It must be bumped whenever the manifest schema receives a breaking change. It's not used by the workflow but reserved for human maintainers to track schema changes.

A manifest has a version. It must be bumped whenever the underlying fixture definition is updated and must be provisioned again. Provisioned fixtures have a tag containing this version number to support the detection of stale fixtures. The computed resource group names include the version number, so a script run with an updated manifest will provision new fixtures even if there are stale fixtures with a lower version.

A manifest has a type indicating whether the fixture is `readOnly` or `readWrite`. This is currently used only to help readers quickly understand how the fixture will be used. The provision script does not use it right now.

A manifest has a description. It is human-readable text that explains in natural language what the manifest contains.

A manifest has an array of Bicep configs. Each Bicep config maps to one Bicep template that must be provisioned as part of the fixture. See the dedicated Bicep config section for more information.

A manifest has an optional `postProvisionScript` script. The `postProvisionScript` script must be a self-contained TypeScript script that runs through `tsx`. When we run this script, we pass the provisioned resource group names to it as command-line arguments. One purpose of the `postProvisionScript` script is to support data-plane operations that cannot be expressed in Bicep. Another purpose is to perform operation to persistent fixture.

A manifest has an optional `postTestScript` script. The `postTestScript` script must be a self-contained TypeScript script that runs through `tsx`. When we run this script, we pass the provisioned resource group names to it as command-line arguments. One purpose of the `postTestScript` script is to perform operations to a persistent resource for cost saving purposes. For example, if we have a persistent Kusto Cluster as the test fixture, we the `postTestScript` script can stop it after the test finishes.

### Bicep config

A fresh provisioning task for each Bicep config creates a resource group and Azure resources in it.

A Bicep config has a required `fixtureId`. It uniquely identifies the resource group and all its child resources. Provisioned fixtures have a tag containing the `fixtureId` so they can be programmatically searched.

A Bicep config has a required `path`. It is the path to the Bicep template that defines all the resources to be provisioned in the resource group, relative to the location of the manifest.

A Bicep config has a required `location`. It determines the Azure location, such as `eastus`, in which to create the resource group and provision its child resources.

A Bicep config has a required `resourceGroupNameBase`. This text provides the recognizable portion of the resource group name. The complete resource group name is computed for each run.

A Bicep config has an optional `parameters` array. This array provides parameter values to pass to the Bicep template during provisioning. The author can define parameters with explicit values, which are passed as is, or define substitution parameters (for example, known keys without values), which resolve to values at provisioning time. The provision-fixture script supports a predefined set of substitution parameters.

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

##### Non-persistent

By default, fixtures are not persisted. Every new run provisions a fresh fixture. A random suffix is appended to the actual resource group names so that concurrent script runs don't run into name collision.

For each Bicep config:

1. Provision the fixture.

The script first creates the target resource group by using the Azure CLI. The command uses the computed resource group name and adds the following tags:

- `FixtureId={fixtureId of the Bicep config}`
- `FixtureVersion={version of the manifest}`
- `DeleteAfter={3 hours after the current time}`, so the cleanup script can delete the resource group
- `Completed=False`, indicating the provision hasn't finished yet

It then uses the Azure CLI to deploy the Bicep template to this resource group. All declared parameters are resolved before the Azure CLI is invoked and are passed to the Bicep template.

After all the Bicep templates are provisioned, the script uses Azure CLI to update the `Completed=False` tag to `Completed=True` indicating the provision has completed.

The Vally executor attempts to delete the provisioned fixtures after the test finishes.

##### Persistent

Persistent fixtures are explicitly declared to be persistent in their manifests. When the provision-fixture script sees a persistent manifest. It expects none of its resources have been provisioned or all the resources to have been provisioned already.

It first discovers provisioned fixtures by searching for resource groups with matching `fixtureId`+`fixtureVersion` and the `Completed=True` tag. If it find partially provisioned fixtures, the script will report an error and exit. If it finds more than one fixture for each fixtureId, the script will report an error and exit.

If it finds no provisioned fixture, it will start provisioning the Bicep templates sequentially like the non-persistent case, except that it will set the tag to make the clean up workflow skip them:

- `DoNotDelete=True`

The Vally executor will not attempt to delete the persistent fixtures after the test finishes.

> Note: the author understands that two concurrent runs of the provision script may race and generate more than one instance of the persistent resources. The chance of such race condition is considered low. Maintainers of the test subscription will monitor when it happens and manually resolve the conflicts.

If it finds all the provisioned fixture, it will present them to the test as if they were provisioned in this run.

#### Output

The provision-fixture script returns the output to the caller from its helper function for provisioning a Bicep config.

#### PostProvision script

After provisioning all the Bicep configs, the script executes each `postProvision` script by using `tsx`.

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

### Error handling

The provisioning script will exit with a non-zero exit code if it encounters any non-recoverable error.

Our custom Vally executor runs the provisioning script before running the test. If the script exits with a non-zero exit code, the executor aborts the test run and reports the error.

## Operation notes

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

## Questions and answers

Q: Why do we require `postProvision` scripts to be written in TypeScript?
A: This is primarily for a cross-platform development experience. Windows development machines usually do not have Bash, and non-Windows development machines usually do not have PowerShell. Developing in the repository already requires TypeScript, so this approach works for everyone contributing to it.

Q: Why do we make the custom vally executor run the provision script?
A: Vally runs environment commands from the test workspace, which is located in the system's temporary directory. This makes external scripts difficult to use because navigating the file system to locate them is difficult. The custom Vally executor knows the location of the test repository, so it can locate the script file more easily.

Q: Why don't we always persist fixtures for readOnly fixtures by default?
A: Some resource types, such as database servers and compute, can incur significant costs over time. The persistent feature is an opt-in feature since it requires the author to be careful with costs.

## References

- [vally-eval](./.github/skills/vally-eval/)
- [vally-executor](./tests/vally/vally-executor.ts)
- [nightly-integration-test](./.github/workflows/test-all-integration.yml)
