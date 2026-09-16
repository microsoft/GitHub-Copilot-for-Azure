# Foundry IQ Skills

Build search and grounded AI experiences with Azure AI Search ([Microsoft Foundry IQ](https://learn.microsoft.com/azure/search/agentic-retrieval-overview)).

This plugin helps GitHub Copilot CLI guide you from setup through production, using your existing Azure resources when possible.

## Skill

- **foundry-iq**: Build, improve, and troubleshoot Azure AI Search applications and Foundry IQ knowledge experiences.

## What it helps with

- Add search to an application
- Make local files, Blob Storage, SharePoint, or public websites searchable
- Ground an existing agent in your organization's content
- Return answers with citations while respecting user permissions
- Measure and improve search quality
- Prepare a search or knowledge solution for production
- Troubleshoot access, ingestion, network, and missing-result problems

The skill is intended for search and knowledge workloads. It is not needed for ordinary code edits or questions about a single file.

## Prerequisites

- [Git](https://git-scm.com/downloads), required to add the plugin marketplace
- [GitHub Copilot CLI](https://github.com/github/copilot-cli)
- Access to the Azure subscriptions and resources involved in your request
- An authenticated Azure identity with the permissions required for the requested read or change

If you use Azure CLI for authentication, install the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) and sign in:

```bash
az login
```

The plugin supports Copilot CLI on Windows and Linux. Depending on the task, it uses supported Azure SDK, REST, infrastructure-as-code, Azure MCP Server, or native knowledge-base MCP interfaces.

## Installation

Run these commands in Copilot CLI:

```text
/plugin marketplace add microsoft/azure-skills
/plugin install foundry-iq-skills@azure-skills
```

To update the plugin:

```text
/plugin update foundry-iq-skills@azure-skills
```

## Example prompts

- "Add production-ready search to this application using our existing product data."
- "Make `./docs` searchable and answer questions with citations."
- "Ground our existing agent in content from this Azure Blob container."
- "Build a SharePoint assistant that respects each user's document permissions."
- "Measure our retrieval quality and recommend one improvement."
- "Find out why today's documents are missing from search results."
- "Prepare this prototype for production with no public network access."

## Before changes are made

The skill starts by inspecting your environment without changing it. It prefers existing resources and uses Microsoft Entra ID and managed identities by default.

It asks for your approval before it:

- Creates or scales resources that may cost money
- Changes permissions, networking, or encryption
- Uploads private content or sends it to an AI model
- Changes production resources or replaces an index

The skill does not delete Azure resources. It can provide a cleanup plan for you to review separately.

## Learn more

- [Azure AI Search overview](https://learn.microsoft.com/azure/search/search-what-is-azure-search)
- [Foundry IQ and agentic retrieval](https://learn.microsoft.com/azure/search/agentic-retrieval-overview)
- [Azure AI Search API and SDK versions](https://learn.microsoft.com/azure/search/search-api-versions)
- [Azure AI Search REST API](https://learn.microsoft.com/en-us/rest/api/searchservice/?source=recommendations)
- [Azure MCP Server tools for Azure AI Search](https://learn.microsoft.com/azure/developer/azure-mcp-server/tools/azure-ai-search)
- [Foundry IQ skill details](skills/foundry-iq/SKILL.md)
