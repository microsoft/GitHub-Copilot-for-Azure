# Create Hosted Agent Application

Create new hosted agent applications for Microsoft Foundry, or convert existing agent projects to be Foundry-compatible. The recommended path is the **`azd ai agent` CLI** (preview). This skill does NOT use direct `az` CLI, REST calls, or MCP tools for the create flow.

## Quick Reference

| Property | Value |
|----------|-------|
| **Primary tool** | `azd ai agent` CLI (preview) |
| **Templates** | `azd ai agent sample list -o json` |
| **Scaffold** | `azd ai agent init [-m <manifest>] [--src <dir>] [--protocol <p>] [--agent-name <name>]` |
| **Local run** | `azd ai agent run` (serves on `:8088`) |
| **Local invoke** | `azd ai agent invoke --local <payload>` |
| **Provision deps** | `azd provision` (project, model, etc. that the agent needs) |
| **Hosted Agents Docs** | https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents |
| **Default Selection** | `Python` + `responses` + `Microsoft Agent Framework` |
| **Best For** | Creating new or converting existing agent projects for Foundry |

## When to Use This Skill

- Create a new hosted agent application from scratch (greenfield)
- Start from an official Foundry template and customize it
- Convert an existing agent project to be Foundry-compatible (brownfield)
- Help user choose a language, protocol, framework, or starter template for their agent

## Prerequisites

See [Common Guidelines](references/common-guidelines.md) for prerequisite checks and guardrails.

## Workflow

### Step 1: Determine Scenario

Check the user's workspace for existing agent project indicators:

- **No agent-related code found** -> **Greenfield**. Follow [Greenfield: Create New Hosted Agent](references/create-greenfield.md).
- **Existing agent code present** -> **Brownfield**. Follow [Brownfield: Convert Existing Agent](references/create-brownfield.md).
