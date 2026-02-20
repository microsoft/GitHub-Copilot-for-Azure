---
name: create
description: |
  Create hosted agent applications for Microsoft Foundry. Supports greenfield projects using Microsoft Agent Framework, LangChain/LangGraph, or custom frameworks in Python or C#. Downloads starter samples from the official foundry-samples repository.
  USE FOR: create agent, new agent, scaffold agent, start agent project, greenfield agent, build hosted agent, new foundry agent, create from sample, langchain agent, langgraph agent, custom agent.
  DO NOT USE FOR: deploying agents (use deploy), invoking agents (use invoke), troubleshooting (use troubleshoot), creating Foundry projects (use project/create).
---

# Create Hosted Agent Application

Create new hosted agent applications for Microsoft Foundry by downloading official starter samples and customizing them.

## Quick Reference

| Property | Value |
|----------|-------|
| **Samples Repo** | `microsoft-foundry/foundry-samples` |
| **Python Samples** | `samples/python/hosted-agents/{framework}/` |
| **C# Samples** | `samples/csharp/hosted-agents/{framework}/` |
| **Best For** | Creating new hosted agent projects from official samples |

## When to Use This Skill

- Create a new hosted agent application from scratch
- Start from an official sample and customize it
- Help user choose a framework or sample for their agent

## Workflow

### Step 1: Determine Scenario

Check the user's workspace for existing agent project indicators:

- **No agent-related code found** → **Greenfield**. Proceed to Step 2.
- **Existing agent code present** → **Brownfield**. TODO: Not yet supported. Offer to create a new project in a subdirectory instead.

### Step 2: Gather Requirements

If the user hasn't already specified, use `ask_user` to collect:

**Framework:**

| Framework | Python Path | C# Path |
|-----------|------------|---------|
| Microsoft Agent Framework (default) | `agent-framework` | `AgentFramework` |
| LangGraph | `langgraph` | ❌ Python only |
| Custom | `custom` | `AgentWithCustomFramework` |

**Language:** Python (default) or C#.

> ⚠️ **Warning:** LangGraph is Python-only. For C# + LangGraph, suggest Agent Framework or Custom instead.

If user has no specific preference, suggest Microsoft Agent Framework + Python as defaults. When using Agent Framework, read the [Agent Framework best practices](references/agentframework.md) for hosting adapter setup, credential patterns, and debugging guidance.

### Step 3: Browse and Select Sample

List available samples using the GitHub API:

```
GET https://api.github.com/repos/microsoft-foundry/foundry-samples/contents/samples/{language}/hosted-agents/{framework}
```

If the user has specified any information on what they want their agent to do, just choose the most relevant or most simple sample to start with. Only if user has not given any preferences, present the sample directories to the user and help them choose based on their requirements (e.g., RAG, tools, multi-agent workflows, HITL).

### Step 4: Download Sample Files

Download only the selected sample directory — do NOT clone the entire repo.

**Using `gh` CLI (preferred if available):**
```bash
gh api repos/microsoft-foundry/foundry-samples/contents/samples/{language}/hosted-agents/{framework}/{sample} \
  --jq '.[].download_url' | while read url; do
  curl -sL "$url" -o "$(basename "$url")"
done
```

**Using curl (fallback):**
```bash
curl -s "https://api.github.com/repos/microsoft-foundry/foundry-samples/contents/samples/{language}/hosted-agents/{framework}/{sample}" | \
  jq -r '.[] | select(.type=="file") | .download_url' | while read url; do
    curl -sL "$url" -o "$(basename "$url")"
  done
```

For nested directories, recursively fetch contents for entries where `type == "dir"`.

### Step 5: Customize and Implement

1. Read the sample's README.md to understand its structure
2. Read the sample code to understand patterns and dependencies used
3. If using Agent Framework, follow the best practices in [references/agentframework.md](references/agentframework.md)
4. Implement the user's specific requirements on top of the sample
5. Update configuration (`.env`, dependency files) as needed.
6. Ensure the project is in a runnable state

### Step 6: Verify Startup

1. Install dependencies (use virtual environment for Python)
2. Ask user to provide values for .env variables if placeholders were used using `ask_user` tool.
3. Run the main entrypoint
4. Fix startup errors and retry if needed
5. Send a test request to the agent. The agent will support OpenAI Responses schema.
6. Fix any errors from the test request and retry until it succeeds
7. Once startup and test request succeed, stop the server to prevent resource usage

**Guardrails:**
- ✅ Perform real run to catch startup errors
- ✅ Cleanup after verification (stop server)
- ✅ Ignore auth/connection/timeout errors (expected without Azure config)
- ❌ Don't wait for user input or create test scripts

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| GitHub API rate limit | Too many requests | Authenticate with `gh auth login` |
| `gh` not available | CLI not installed | Use curl REST API fallback |
| Sample not found | Path changed in repo | List parent directory to discover current samples |
| Dependency install fails | Version conflicts | Use versions from sample's own dependency file |
