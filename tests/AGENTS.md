# Skills Testing Guide

> **For AI Agents**: This document provides patterns and conventions for creating and maintaining tests for azure-skills plugin. When asked to "scaffold tests" for a skill, follow the instructions below.

## Scaffolding Tests for a Skill

When a user asks to scaffold, create, or add tests for a skill, follow these steps:

### Step 1: Read the vally-eval skill

Skills in azure-skills plugin use [vally](https://microsoft.github.io/vally/get-started/) to run integration tests that run prompts against an LLM Agent and evaluate the outcome. The vally-eval skill provides the knowledge on where to add the test code, how to run the tests and where to collect the test results. Combine the instructions in vally-eval skill, the official documentation of vally and the rest of the instructions in this file to learn how to write vally eval suites for azure-skills plugin. 

### Step 2: Read the skill's SKILL.md
Load the file at `plugin/skills/{skill-name}/SKILL.md` to understand:
- The skill's name and description (from frontmatter)
- What the skill does (from content)
- What Azure services/tools it references

**Also check for references:** If the skill has a `references/` folder, note the structure:
- `references/recipes/` - Multiple implementation approaches (azd, bicep, terraform)
- `references/services/` - Multiple Azure services the skill supports
- References load only when explicitly linked, so understand what paths SKILL.md links to

### Step 3: Write eval spec
Based on the skill's description and content, create test cases in which a user would submit prompts that trigger the agent to load the skill, do some work and accomplish something for the user.

Follow the vally documentation to write the eval suite for each test case. Each test case consists of the following things:

1. The environment in which the user prompts the agent. This can include source code in the local workspace, access to local CLI tools, access to Cloud resources, etc. For example, if the user prompt asks the agent to deploy an app to Azure, the workspace should already have the source code of the app.
2. The user prompt that triggers the agent to do work. The user prompt should imitate what a reasonable user would submit in practice. Avoid giving too little or too much details in the test user prompt. If a test case naturally requires multi-turn agent interaction, such as user confirmation, it can specify follow up prompts to simulate multi-turn interactions with the agent.
3. The pass/fail criterion for the outcome. For example, a test case can expect the agent to load a certain skill, emit certain tokens to the user as assistant messages, not emit certain tokens, etc. See [vally-graders-catalog](https://microsoft.github.io/vally/reference/graders/) to learn what graders are supported.

### Step 4: Run and verify locally

Sign into Copilot CLI locally to make sure Copilot SDK can access CAPI. Run this command to run all tests for the new skill.

```bash
cd tests

# Run all tests for {skill-name}
npm run test:vally -- --skill {skill-name}
```

### Step 5: Configure nightly integration test runs

Skills in azure-skills plugin are configured to run nightly tests and publish test results. If you are adding tests for a new skill that hasn't been configured before, you need to make changes to configure it.

Before adding the tests to the nightly run, evaluate the cost of the tests to make sure all the tests of the new skill can consistently finish in less than 6 hours. We run all the tests for each skill in one GitHub Actions job, which can only run for 6 hours. If the tests takes a long time to finish, consider breaking long duration tasks down or using earlyTerminate tags to make them more efficient.

After that, follow these steps to add the new tests to the scheduled jobs.

- Add the skill to [skills.json](./skills.json). Add one entry in the full skill list and another in one of the existing schedule slots. azure-deploy and microsoft-foundry have their own slot because they take much longer than the rest of the skills. Try adding the new tests to the slot where all other skills belong to unless there are issues. **DO NOT** create a new schedule slot.
- Manually queue a job at [test-all-integration](https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/workflows/test-all-integration.yml) workflow. Provide the name of the new skill as input. Wait and check to make sure the job can run the new tests.
- Wait for one day for the nightly test run to finish and check the results at the [integration tests dashboard](https://aka.ms/azure-skills-tests).

## Overview

> Note: azure-skills plugin used to use an in-house Jest based test framework to run integration tests. We have deprecated that. All new tests should be written as vally eval suites instead.

azure-skills plugin uses **Vally** to validate skill behavior across these test categories:
- **Skill format** - Validate if the skills have correct format. Vally has built-in rules for validating skill format. We don't need explicit test code for that.
- **Integration Tests** - Run target prompts against a real LLM agent and evaluate the outcome.

## Quick Reference: Test File Conventions

## Test File Conventions

### File Naming

| File | Purpose |
|------|---------|
| `evals/<skill-name>/eval.yaml` | Definition of test cases for a skill |
| `evals/<skill-name>/fixtures/**/*` | Optional files for initializing a test environment |

### Directory Structure

```
evals/{skill-name}/
├── eval.yaml
└── fixtures/        # Optional
    └── data.json
```

## Using Fixtures

Follow 

## Writing Integration Tests

Integration tests run a real Copilot agent session to verify skill behavior.

### Prerequisites

1. Install Copilot CLI: `npm install -g @github/copilot-cli`
2. Authenticate: Run `copilot` and follow prompts

## Running Tests

### Local Development

Run tests for a skill locally using this command.

```bash
cd tests

# Run all tests for {skill-name}
npm run test:vally -- --skill {skill-name}
```

### CI Environment

Run tests for a subset of skills in the CI workflow by manually queuing a job at [test-all-integration](https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/workflows/test-all-integration.yml) and collect the test results at the destination storage account, or collect the test results from nightly runs at the destination storage account.

## Coverage Requirements

Every skill must have integration tests that checks for the skill invocation. For skills that involves calling tools, we strongly recommend adding tests that check for expected tools.
