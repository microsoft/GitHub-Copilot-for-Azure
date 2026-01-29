# Integration test architecture

## Prerequisite

To run tests, you need to be able to use Copilot CLI in the host machine. The test code uses Copilot SDK, which shares credential with Copilot CLI.

## Quick Start

1. Install Copilot CLI globally by running `npm install -g @github/copilot-cli`.
2. Navigate to the `integration-tests` directory and run `npm install`.
3. Open a terminal and run `copilot`. Follow the instructions to login to your GitHub account.
4. Open a new terminal with `integration-tests` as the working directory, run `npm test` to run all the tests.
5. (Optional) Use mocha cli to run a selected subset of tests.

## Overview

Every integration test consists of 3 steps

- Setup
- Agentic flow
- Evaluation

### Setup

The `runner` function creates a temporary directory on the host machine and passes to the optional `setup` function for creating the necessary environment for the test to run. This can be useful if your skill assumes the existence of project files in a workspace, assumes externally provisioned resources, or anything that needs to be present before starting the agentic flow. You can use the setup function to bootstrap the project files.

### Agentic flow

After running `setup`, the `runner` function will start an agentic flow using Copilot SDK. The agent will use the previously created temporary directory as the working directory. In addition, the agent will have access to all the skills in this repository and Azure MCP tools. The runner will collect all the events emitted by the agent (aka. agentMetadata) and return once the agent finishes working.

### Evaluation

The skill test author can write code to evaluate whether the outcome of the agentic flow is good. It can read the collected agentMetadata to determine if the correct skills/tools have been used. It can also read files left in the workspace or query resources to capture changes to the environment.

## Contribute new tests

Create a directory with the same name of the skill the tests will be for (e.g. azure-role-selector). Implement the `setup` function for your test, call the main runner to trigger the agentic flow, and use the agentMetadata to evaluate whether the agentic flow has achieved a desirable outcome.