# Custom vally executor

This repository hosts the following custom vally executors for integration tests:

- copilot-sdk-agent-runner
- claude-sdk-agent-runner

These custom executors support features allowing the eval authors to have a finer level control of the test agent. They produce artifacts compatible with the evaluation workflows and reporting website of this repo.

## Agent runner

Vally custom executors are wrappers around agent runners. Here are the guidelines for implementing a new custom agent runner.

### IAgentRunner interface

All agent runners implement the IAgentRunner interface. The configuration controls how the runner starts the agent, how to react to situations during the run and how to clean up the dynamically created resources for the run.

An agent run starts with submitting a user prompt to a pre-configured agent session to do work. It ends with the agent signaling the runner that no more work needs to be done or the agent runner aborting the run when certain conditions are met.

### Process agent trajectory data

The agent runner must save trajectory data emitted during the test run. These data reflects what happened during the test run so the graders can determine if the outcome is good and the human reviewers can study the agent behavior.

All agent runners must save the trajectory data as Copilot SDK SessionEvents. The copilot-sdk-agent-runner produces compatible events by design. The claude-sdk-agent-runner produces events using a different protocol. As a result, a translation layer is needed to convert the Claude SDK trajectory data to Copilot SDK SessionEvents. Such agent runners can optionally choose to save the original trajectory data for custom processing.

When the trajectory data from the agent allows, the runner should implement features that allow it to react to certain situations during the run, such as earlyTerminate. These features allow users of the runner to evaluate scenarios of interest more efficiently.

### Compute statistics

The agent runner must compute and save statistics after the run ends. These statistics include token usage, tool count, loaded skills, etc. The runner should try its best to compute these statistics using the trajectory data emitted by the agent. If the trajectory data emitted by the agent doesn't allow computing any of these statistics, it should be documented and the data field should be left with a placeholder value.

### Use shared utility

[agent-runner.ts](../tests/utils/agent-runner.ts) implemented helper functions that can be useful in most agent runners. Use them at your discretion.

## Executor

TBD: Pending deduplication refactoring