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

Without fixture, our evaluations are limited in the following ways:

1. We cannot test scenarios that require a precise fixture. For example, for azure-diagnostics, if we cannot present a resource for it to diagnose, our test cases are limited to verifying if the skill is invoked or if it can answer informational questions. 

2. We cannot compare the agent outcome with a ground truth answer. For example, azure-resource-lookup and azure-resource-visualizer have open ended test cases where the agent picks some resource group to enumerate the resources or generate mermaid diagram. If we can limit the agent to operate on fixture, we can pre-compute the ground truth answer and check if the agent got it correctly.

3. Comparing token usage becomes hard. We can only meaningfully compare token usage when the agent operate on the same set of resources and result in the same outcome.

## Types of fixtures

There are two types of fixtures:

- read-only fixture

For this type of fixture, the agent task reads data of the resources but don't modify them.

- read-write fixture

For this type of fixture, the agent task reads data of the resources and modify them.

## Evaluation setup

### Files
A test case (vally stimuli) defines its Azure fixtures in the following files.

- A manifest.json file, called "manifest" below.
- One or more .bicep templates. Each templates are written at the "resource group scope".
- An environment command in the vally stimuli that executes a "provision-fixture" script, with the manifest as the cmd input.
- A provision-fixture script that handles provisioning fixtures.
- A clean up script that can delete fixtures from a manifest.

### Manifest

The manifest contains information to support the following tasks:

1. Find provisioned fixtures
2. Delete stale provisioned fixtures
3. Provision new fixtures
4. Compute the context prompt to send to the LLM to scope its operations

The "provision-fixture" script is responsible for these tasks. The vally executor will use its output when running the integration test.

A manifest has a schemaVersion. It needs to be bumped every time the manifest schema gets a breaking change.

A manifest has a version. It needs to be bumped every time the underlying fixture definition is updated and needs to be provisioned again. The provisioned fixtures will have a tag carrying this version number to support detecting stale fixtures. The computed resource group names carry the version number so a script run with an updated manifest can delete the stale fixtures and provision the new fixture at the same time.

A manifest has a type indicating if the fixture is readOnly or readWrite.

A manifest has a description. It's a human facing piece of text explaining what this manifest contains in natural language.

A manifest has an array of bicep configs. Each bicep config maps to one Bicep template that needs to be provisioned as a part of the fixture. See dedicated section for Bicep config to learn more.

A manifest has an optional array of postProvision scripts. Each postProvision script must be a self-contained Typescript script runs through tsx. When we run the postProvision scripts, we pass the provisioned resource group names as the cmd arguments to it. One of the purpose of having postProvision scripts is to support performing data plane operations that cannot be expressed by Bicep.

### Bicep config

A fresh provision task of each Bicep config will create a resource group and Azure resources created in it.

A Bicep config has a required "fixtureId". It's the unique identifier that identifies the resource group and all the child resources in it. Provisioned fixtures will have a tag carrying the fixtureId so people can search for provisioned fixtures for this Bicep config.

A Bicep config has a required "path". It is the relative path to the Bicep template that defines all the resources to be provisioned in the resource group. The path is relative to the location of the manifest.

A Bicep config has a required "location". It determines which Azure Location to create the resource group and provision the child resources to, such as eastus.

A Bicep config has a required "resourceGroupNameBase". This piece of text will give the representative portion of the resource group name. The actual resource group name will be computed from the manifest data.

A Bicep config has an optional "parameters" array. This array provides parameter values to be passed to the Bicep template when provisioning it. The author can define parameters with explicit values, which will be passed as is, or define "substitution" parameters (e.g. known keys without value) that resolves to values at provisioning time. The provision-fixture script supports a fixed set of substitution parameters.

### Provision-fixture script

The provision-fixture script manages the lifecycle of all the fixtures and makes sure it's 

#### Context

The script maintains a "context". The context contains the metadata of the script run and pre-computed values that can be used as substitution parameters.

- runId: a unique random UUID of the run
- suffix: a randomly generated suffix for resource group name, only used for readWrite fixtures
- subscriptionId: subscription ID of the test subscription
- tenantId: tenant ID of the test subscription
- resourceGroupNames: the actual resource group names computed for this run
- testPrincipalId: the principal ID of the test principal. For CI runs this will be the Managed Identity. For local runs this will be the user principal.

The context is computed at the beginning of the script run.

#### Provisioning

The script iterates through all the Bicep configs and provision each of them.

##### ReadOnly

ReadOnly fixtures are provisioned once, persisted and reused by test runs depending on them. Stale readOnly fixtures will be deleted.

For each Bicep config:

1. Scan to find existing fixture

If an existing resource group with matching fixtureId is found, check the version to see if it's stale (provisioned version is lower than current version). If the provisioned fixture is not stale, skip the rest of the steps.

2. Delete the stale fixture

If a stale resource group with matching fixtureId is found, the script will schedule the deletion of it without waiting for it to finish. Otherwise, skip this step.

3. Provision the new fixture

The script first creates the target resource group using Azure CLI. The Azure CLI command will use the computed resource group name and add the following tags to it:

- FixtureId={fixtureId of the Bicep config}
- FixtureVersion={version of the manifest}
- DoNotDelete=true, so the clean up script won't delete these fixtures

Then it uses Azure CLI to provision the Bicep template to this resource group. All the declared parameters are resolved before invoking Azure CLI and passed as parameters to the Bicep template.

##### ReadWrite

ReadWrite fixtures are not persisted. Every new run provisions a fresh fixture. A random suffix is appended to the actual resource group names so that concurrent script runs don't run into name collision.

For each Bicep config:

1. Provision the fixture

The script first creates the target resource group using Azure CLI. The Azure CLI command will use the computed resource group name and add the following tags to it:

- FixtureId={fixtureId of the Bicep config}
- FixtureVersion={version of the manifest}
- DeleteAfter={3 hour after the current time}, so the clean up script will ensure deleting them

Then it uses Azure CLI to provision the Bicep template to this resource group. All the declared parameters are resolved before invoking Azure CLI and passed as parameters to the Bicep template.

As an optimization, the vally executor will attempt to delete the readWrite fixtures after the test finishes. The DeleteAfter tag is added just in case.

#### PostProvision script

After provisioning all the Bicep configs, the script iteratively execute every postProvision script using tsx.

The postProvision script can be used for these purposes:

- Perform data plane operations not supported by Bicep. For example, upload a blob to a blob container
- Perform a readiness check. For example, RBAC propagation may take some time to propagate. If this frequently happen for a test case we can introduce an artificial delay or keep polling until certain conditions are met.

#### Output

Before exit, the script writes to a file with a fixed name to the test workspace. The file contains names of all the resource groups that should be used by the integration test.

### Executor injecting fixture context

If the provision script completed with a 0 exit code, vally will reach our custom vally executor to run the test. Our vally executor has access to the environmental configuration to the stimuli and can tell when the test case has declared Azure fixtures. For test cases that have defined Azure fixture, the executor can read the output file in the current workspace, inject additional context and delete the file before starting the test agent run.

The injected context will be appended to the first user prompt with the following content:

- Instruction: limit your operation to the following resource group(s)
- Data: the resource groups to be used as the fixture.

The original user prompt in the stimuli must not give conflicting information. Most existing integration tests don't provide any resource scope. Some needs to be rewritten to remove resource scopes and delegate it to the fixture.

### Error handling

The provisioning script will exit with a non-zero exit code if it encounters any non-recoverable error.

Vally runs the provisioning script before reach to our custom vally executor. If the provisioning script exits with a non-zero exit code, vally will abort the test run and report the error.

## Cost consideration

Since read-only fixtures are long-lived, refrain from using expensive resources that incur significant cost over time (e.g. database servers, app services, app config, etc.)

## Operation notes

Here are how operations look like with the process in place:

1. Add fixture to a test case

- Design the fixture that can be represented by Bicep
- Write the manifest and the Bicep templates
- Write postProvision script for anything not covered by Bicep
- Write the test prompt with the fixture in mind
- Add environment command to call the provision script with the manifest

The user needs to be aware that fixture context are injected to not provide conflicting instructions in the original test prompt. A rule can be added to copilot-instructions.md to catch these issues in Copilot code review. A new section in vally-eval skill can be added to help user create fixtures for a test case.

2. Update fixture for a test case

- Modify the manifest and the Bicep template
- Bump the version of the manifest

The next run of the provision script will delete the stale readOnly fixture and provision a new one, or provision a new one for readWrite fixture.

3. Remove a test case

- Use the clean up script with the manifest to delete all the resource groups with matching fixtureId(s).
- Remove the test case and all the files for its fixtures.

## Questions and answers

TBD

## References

- [vally-eval](./.github/skills/vally-eval/)
- [vally-executor](./tests/vally/vally-executor.ts)
- [nightly-integration-test](./.github/workflows/test-all-integration.yml)
