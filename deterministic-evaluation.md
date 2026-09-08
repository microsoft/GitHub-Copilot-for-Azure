# Deterministic evaluation with Azure fixtures

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

Without fixtures, our evaluations are limited in the following ways:

1. We cannot test scenarios that require a specific fixture. For example, for azure-diagnostics, if we cannot provide a resource for it to diagnose, our test cases are limited to verifying whether the skill is invoked or can answer informational questions.

2. We cannot compare the agent outcome with a ground-truth answer. For example, azure-resource-lookup and azure-resource-visualizer have open-ended test cases in which the agent picks a resource group and either enumerates its resources or generates a Mermaid diagram. If we can limit the agent to operating on a fixture, we can precompute the ground-truth answer and check whether the agent produced the correct result.

3. Comparing token usage becomes difficult. We can only meaningfully compare token usage when the agent operates on the same set of resources and produces the same outcome.

## Types of fixtures

There are two types of fixtures:

- `readOnly` fixture

For this type of fixture, the agent task reads resource data but does not modify it.

- `readWrite` fixture

For this type of fixture, the agent task reads and modifies resource data.

## Evaluation setup

### Files

A test case (Vally stimulus) defines its Azure fixtures with the following files:

- A `manifest.json` file, called the "manifest" below.
- One or more `.bicep` templates. Each template is written at resource group scope.
- An `azureFixture` tag in the stimulus containing the path to the manifest, relative to the stimulus file.

The setup also uses two shared scripts:

- A provision-fixture script that handles fixture provisioning.
- A cleanup script that can delete fixtures defined by a manifest. This is not used by the test workflow, but reserved for devs to clean up resources created by local test runs more easily.

### Manifest

The manifest contains the information needed to support the following tasks:

1. Find provisioned fixtures (if needed)
2. Delete stale provisioned fixtures (if needed)
3. Provision new fixtures
4. Compute the context prompt to send to the LLM to scope its operations

The "provision-fixture" script is responsible for these tasks. The vally executor will use its output when running the integration test.

A manifest has a `schemaVersion`. It must be bumped whenever the manifest schema receives a breaking change. It's not used by the workflow but reserved for human maintainers to track schema changes.

A manifest has a version. It must be bumped whenever the underlying fixture definition is updated and must be provisioned again. Provisioned fixtures have a tag containing this version number to support the detection of stale fixtures. The computed resource group names include the version number, so a script run with an updated manifest may delete stale fixtures and provision new ones at the same time in the future.

A manifest has a type indicating whether the fixture is `readOnly` or `readWrite`. This is currently used only to help readers quickly understand how the fixture will be used. The provision script does not use it right now. If we want to persist fixtures for `readOnly` type fixtures by default in the future, this type can be used.

A manifest has a description. It is human-readable text that explains in natural language what the manifest contains.

A manifest has an array of Bicep configs. Each Bicep config maps to one Bicep template that must be provisioned as part of the fixture. See the dedicated Bicep config section for more information.

A manifest has an optional array of `postProvision` scripts. Each `postProvision` script must be a self-contained TypeScript script that runs through `tsx`. When we run the scripts, we pass the provisioned resource group names to them as command-line arguments. One purpose of `postProvision` scripts is to support data-plane operations that cannot be expressed in Bicep.

### Bicep config

A fresh provisioning task for each Bicep config creates a resource group and its Azure resources.

A Bicep config has a required `fixtureId`. It uniquely identifies the resource group and all its child resources. Provisioned fixtures have a tag containing the `fixtureId` so that users can search for fixtures provisioned from this Bicep config.

A Bicep config has a required `path`. It is the path to the Bicep template that defines all the resources to be provisioned in the resource group, relative to the location of the manifest.

A Bicep config has a required `location`. It determines the Azure location, such as `eastus`, in which to create the resource group and provision its child resources.

A Bicep config has a required `resourceGroupNameBase`. This text provides the recognizable portion of the resource group name. The complete resource group name is computed for each run.

A Bicep config has an optional `parameters` array. This array provides parameter values to pass to the Bicep template during provisioning. The author can define parameters with explicit values, which are passed as is, or define substitution parameters (for example, known keys without values), which resolve to values at provisioning time. The provision-fixture script supports a fixed set of substitution parameters.

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

The script iterates through all the Bicep configs and provisions each one.

Fixtures are not persisted. Every new run provisions a fresh fixture. A random suffix is appended to the actual resource group names so that concurrent script runs don't run into name collision.

For each Bicep config:

1. Provision the fixture.

The script first creates the target resource group by using the Azure CLI. The command uses the computed resource group name and adds the following tags:

- `FixtureId={fixtureId of the Bicep config}`
- `FixtureVersion={version of the manifest}`
- `DeleteAfter={3 hours after the current time}`, so the cleanup script can delete the resource group

It then uses the Azure CLI to deploy the Bicep template to this resource group. All declared parameters are resolved before the Azure CLI is invoked and are passed to the Bicep template.

As an optimization, the Vally executor attempts to delete the provisioned fixtures after the test finishes. The `DeleteAfter` tag allows the external cleanup script to find and delete them if this attempt fails.

#### PostProvision script

After provisioning all the Bicep configs, the script executes each `postProvision` script by using `tsx`.

The `postProvision` script can be used for these purposes:

- Perform data-plane operations not supported by Bicep. For example, upload a blob to a blob container.
- Perform a readiness check. For example, RBAC changes may take time to propagate. If this frequently happens for a test case, we can introduce an artificial delay or continue polling until certain conditions are met.

#### Output

Before exiting, the script writes the names of all resource groups that the integration test should use to `stdout`.

### Executor injecting fixture context

Our custom Vally executor runs the provision script if an `azureFixture` tag is present. If the provision script completes with an exit code of 0, the executor proceeds to run the test. For test cases that define an Azure fixture, the executor can read the provision script's `stdout` and inject additional context into the test run.

The injected context will be appended to the first user prompt with the following content:

- Instruction: limit your operation to the following resource group(s)
- Data: the resource groups to use as the fixture.

The original user prompt in the stimulus must not provide conflicting information. Most existing integration tests do not provide a resource scope. Some must be rewritten to remove resource scopes and delegate scoping to the fixture.

### Time budget

The provision script must finish within 10 minutes. If it does not, it is aborted with a nonzero exit code. The time budget for tests that require an Azure fixture must account for provisioning time.

### Error handling

The provisioning script will exit with a non-zero exit code if it encounters any non-recoverable error.

Our custom Vally executor runs the provisioning script before running the agent. If the script exits with a nonzero exit code, the executor aborts the test run and reports the error.

## Operation notes

The following operations use this process:

1. Add fixture to a test case

- Design a fixture that can be represented by Bicep
- Write the manifest and the Bicep templates
- Write a `postProvision` script for anything not covered by Bicep
- Write the test prompt that doesn't conflict with the fixture context
- Add the azureFixture tag to tell the custom executor to provision the fixtures

The user must be aware that fixture context is injected so that they do not provide conflicting instructions in the original test prompt. A rule can be added to `copilot-instructions.md` to catch these issues during Copilot code review. A new section can be added to the vally-eval skill to help users create fixtures for a test case with a coding agent.

2. Update fixture for a test case

- Modify the manifest and Bicep templates
- Bump the version of the manifest

Future runs of the provision script will provision the updated version of the fixture.

3. Remove a test case

- Use the cleanup script with the manifest to delete all resource groups with matching `fixtureId` values.
- Remove the test case and all the files for its fixtures.

## Questions and answers

Q: Why do we require `postProvision` scripts to be written in TypeScript?
A: This is primarily for a cross-platform development experience. Windows development machines usually do not have Bash, and non-Windows development machines usually do not have PowerShell. Developing in the repository already requires TypeScript, so this approach works for everyone contributing to it.

Q: Why do we make the custom vally executor run the provision script?
A: Vally runs environment commands from the test workspace, which is located in the system's temporary directory. This makes external scripts difficult to use because navigating the file system to locate them is difficult. The custom Vally executor knows the location of the test repository, so it can locate the script file more easily.

Q: Why don't we persist fixtures for readOnly fixtures?
A: I decided not to include this optimization in the design to simplify fixture lifecycle management. In addition, some resource types, such as database servers and provisioned compute, can incur significant costs over time. We still want to provision and delete those fixtures on demand. We can revisit this optimization later.

## References

- [vally-eval](./.github/skills/vally-eval/)
- [vally-executor](./tests/vally/vally-executor.ts)
- [nightly-integration-test](./.github/workflows/test-all-integration.yml)
