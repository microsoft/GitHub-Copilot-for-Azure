# Azure

[Microsoft Azure](https://azure.microsoft.com) is Microsoft's cloud computing platform. This plugin provides Azure skills and MCP tools for compatible clients, including VS Code, the GitHub Copilot app, [GitHub Copilot CLI](https://github.com/github/copilot-cli), and Claude Code. Available features depend on the client.

## Installation

Review the security warning and Azure setup requirements below before installing.
The installable plugin name is **`azure`**, not its source directory name `azure-skills`.

### VS Code

[Install in VS Code](vscode://chat-plugin/install?source=github%2Fawesome-copilot&plugin=azure)

### GitHub Copilot app

[Install in GitHub Copilot app](ghapp://plugins/install?source=azure%40awesome-copilot)

If a client link does not open, use the [Azure catalog page](https://awesome-copilot.github.com/plugin/azure/) to choose your client.

### Copilot CLI — terminal

Run in Bash or PowerShell:

```text
copilot plugin install azure@awesome-copilot
```

### Alternative: direct Microsoft marketplace

In an interactive Copilot CLI or Claude Code session, run these slash commands
(not Bash or PowerShell commands):

```text
/plugin marketplace add microsoft/azure-skills
/plugin install azure@azure-skills
```

Awesome Copilot pins published packages; its version may differ from the direct
Microsoft marketplace. Update each installed copy through its original marketplace
(`awesome-copilot` or `azure-skills`). Choose one route: avoid duplicate plugin
copies across marketplaces or overlapping skills installed by an extension.
Client availability, trust prompts, and organization policies may affect installation.
Confirm the plugin is enabled and its skills are visible, then start a fresh conversation.
Installation does not authenticate to Azure or grant Azure permissions.

## Security

> [!WARNING]
> The `azure` plugin uses `npx` to download and run the Azure MCP Server, inheriting the local environment's `.npmrc` configuration. Install this plugin only on trusted devices. A compromised `.npmrc` configuration could cause `npx` to download and execute malicious code, potentially resulting in remote code execution.

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.

## Setup

### 1. Create an Azure Account

Sign up at [azure.microsoft.com](https://azure.microsoft.com) or use your existing Azure account.

### 2. Install Node.js and NPM

The Azure MCP Server runs as an NPM package. Ensure you have Node.js 22 or later installed:

- Download from [nodejs.org](https://nodejs.org)
- Or use a version manager like [nvm](https://github.com/nvm-sh/nvm)

### 3. Authenticate to Azure

The Azure MCP Server uses the Azure Identity SDK for authentication. You can authenticate using any of these methods:

#### Option A: Azure CLI (Recommended)
1. Install [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli)
2. Run `az login` to authenticate
3. The MCP server will automatically use your CLI credentials

#### Option B: Environment Variables
Set Azure service principal credentials:

**Bash/Zsh:**
```bash
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_CLIENT_ID="your-client-id"
export AZURE_CLIENT_SECRET="your-client-secret"
```

**PowerShell:**
```powershell
$env:AZURE_TENANT_ID = "your-tenant-id"
$env:AZURE_CLIENT_ID = "your-client-id"
$env:AZURE_CLIENT_SECRET = "your-client-secret"
```

#### Option C: Managed Identity
When running on Azure resources (VMs, Container Apps, etc.), the server automatically uses managed identity.

For more authentication options, see the [Azure Identity documentation](https://learn.microsoft.com/azure/developer/azure-mcp-server/).

## Available Tools

The Azure MCP Server provides tools for 40+ Azure services:

### AI & Machine Learning
- Microsoft Foundry (AI models, deployments, knowledge indexes)
- Azure AI Search (search and vector database)
- Azure AI Services Speech (speech-to-text, text-to-speech)

### Compute & Containers
- Azure App Service, Container Apps, Azure Kubernetes Service (AKS)
- Azure Functions, Virtual Desktop

### Storage & Databases
- Azure Storage (Blob, File Sync)
- Azure SQL Database, Cosmos DB
- Azure Database for MySQL & PostgreSQL

### Security & Networking
- Azure Key Vault (secrets, keys, certificates)
- Azure RBAC (access control)
- Azure Confidential Ledger

### DevOps & Management
- Resource Groups, Subscriptions
- Azure Monitor (logging, metrics)
- Azure CLI command generation
- Bicep templates

### Messaging & Communication
- Azure Communication Services (SMS, email)
- Azure Service Bus, Event Grid

For the complete list of 40+ services, see the [official documentation](https://learn.microsoft.com/azure/developer/azure-mcp-server/).

## Example Usage

Ask your compatible client to:
- "List my Azure storage accounts"
- "Show me all containers in my Cosmos DB database"
- "List all secrets in my key vault 'my-vault'"
- "Deploy a web app to Azure App Service"
- "Query my Log Analytics workspace"
- "Deploy a best-practices Azure Kubernetes Service cluster"
- "Send an SMS message to +1234567890 using Azure Communication Services"
- "Generate an Azure CLI command to create a storage account"

For more examples, visit the [Azure MCP documentation](https://learn.microsoft.com/azure/developer/azure-mcp-server/).

## Documentation

For more information, visit:
- [Azure Documentation](https://docs.microsoft.com/azure)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/)
- [Azure REST API Reference](https://docs.microsoft.com/rest/api/azure/)

## Troubleshooting

### Authentication Issues
- Run `az login` to authenticate with Azure CLI
- Verify you have appropriate Azure RBAC permissions
- Check that your credentials are not expired
- See the [Authentication guide](https://learn.microsoft.com/azure/developer/azure-mcp-server/)

### Server Issues
- Ensure Node.js 22 or later is installed
- Verify NPM can download packages from npmjs.com
- Check the [Troubleshooting guide](https://github.com/microsoft/mcp/blob/main/servers/Azure.Mcp.Server/TROUBLESHOOTING.md)
