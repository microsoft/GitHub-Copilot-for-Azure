# Deterministic evaluation with Azure resource fixtures

## Background

Some integration test cases are designed for scenarios that require preexisting Azure resources. For example,

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
2. We cannot compare the agent outcome with a ground truth answer. For example, azure-resource-lookup and azure-resource-visualizer have open ended test cases where the agent picks some resource group to enumerate the resources or generate mermaid diagram. Since the resource group choice is non-deterministic, we cannot compare the agent outcome with a ground truth answer to tell if the agent produced the correct result. This also makes comparing agent performance across models hard.

## Types of fixtures

There are two types of fixtures:

- read-only fixture

For this type of fixture, the agent task reads data of the resources but don't modify them.

- read-write fixture

For this type of fixture, the agent task reads data of the resources and modify them based on the data.

## Evaluation setup

Let each test case (vally stimuli) declare if it needs Azure fixture and what fixtures it needs. The fixtures will be represented by a manifest and Bicep templates.

The manifest defines provision parameter values needed by the agent to locate these resources, except those that are expected to be dynamically discovered. Authors of the manifest and Bicep templates must make sure they don't introduce conflicts. For example, we cannot let two test cases both declare they need a resource group named "foo". Have each test case use independent fixture for now. We may share read-only type fixtures in the future as an optimization.

A local script can take the manifest and its associated Bicep templates as input, and provision the defined resources. If a test case declares Azure fixtures, a "command" environment config is added to run the local script to provision the fixture resources for the test case. For read-only type fixture, the script will skip if the fixture resources exist or provision them if not. For read-write type fixtures, the script will error if the fixture resources exist or provision them if not. Read-write fixtures will incorporate some pseudorandom parts of the resource names to avoid having collisions in concurrent runs. All provisioned resources will be tagged with DoNotDelete (read-only) or DeleteAfter (read-write) so the clean up script skips the read-only fixtures and pick up read-write fixtures in case the in-workflow deletion failed. The vally executor injects context of the fixture resources into the 1st user prompt to the agent to limit its operation to the expected fixture resources. The vally executor also introduces an small artificial delay before executing the agents (if the script actually provisioned anything) by polling key information so things like RBAC roles have a higher chance to have been propagated when the agent executes. After the test run finishes, the executor use the information in the manifest to schedule a deletion of the read-write type fixture resources.

Each manifest has a version number. If we later need to modify the fixture, we make changes to the fixture and bump the version number. Provisioned resources are tagged with their version number. When the scripts sees a higher version of the local manifest that what has been provisioned, it deletes the old fixture and provisions the new one.

If the provision script encounters a failure (e.g. Azure outage), Vally will abort the test run and report the failure. 

## Technical notes

### Cost consideration

Since read-only fixtures are long-lived, refrain from using expensive resources that incurs significant cost over time (e.g. database servers, app services, app config, etc.). If necessary, override the persist-by-default policy for some read-only fixtures and also provision them on demand.

### Data plane

The local script can be extend to perform data plane operations. Each type of data plane fixture will need to implement its data plane script manually to achieve what they need.

### Subscription

The test setup up assumes the test credential is signed into the test subscription to use. For local use cases, it will use the subscription the user's local Azure CLI is signed in to.

### Access control

Read-only fixtures will be provisioned with the ReadOnly lock to prevent the agent accidentally modifying them.

## References

- [vally-eval](./.github/skills/vally-eval/)
- [vally-executor](./tests/vally/vally-executor.ts)
- [nightly-integration-test](./.github/workflows/test-all-integration.yml)