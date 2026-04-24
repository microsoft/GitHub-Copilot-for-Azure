# GitHub Copilot for Azure

GitHub Copilot for Azure is a set of extensions for Visual Studio, VS Code, and Claude Code designed to streamline the process of developing for Azure. You can ask it questions about your Azure services or get help with tasks related to Azure management and development, all from within your IDE.

[Learn more](https://aka.ms/LearnAboutGitHubCopilotForAzure) about GitHub Copilot for Azure, and get the extension:
- [VS Code](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azure-github-copilot)
- [Visual Studio 2022](https://marketplace.visualstudio.com/items?itemName=github-copilot-azure.GitHubCopilotForAzure2022)
- Visual Studio 2026 - included "in the box" as part of the "Azure & AI" workload
- Claude - coming soon

## Usage

### Prerequisites

Before installing the plugin, ensure the following tools are installed:

#### Git

Git is required to add the marketplace plugin. If it is not installed, you will see an error like:
`Failed to add marketplace: Failed to fetch GitHub marketplace microsoft/azure-skills: Error: spawn git ENOENT`

**Windows (winget):**
```powershell
winget install --id Git.Git -e --source winget
```

**macOS (Homebrew):**
```bash
brew install git
```

#### Node.js

Node.js is required for the Azure MCP server. If it is not installed, you may see errors such as:
- Windows: `'npx' is not recognized as an internal or external command`
- macOS/Linux: `npx: command not found`
- Or the MCP server may fail silently with `npx failed to connect to azure`

**Windows (winget):**
```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

**macOS (Homebrew):**
```bash
brew install node
```

### Installation

#### VS Code

The GitHub Copilot for Azure extension installs skills when the extension activates. At that point, you may see a toast notification like the following (if you don't see it, you can use the manual commands below):

![Toast notification asking "GitHub Copilot for Azure can install skills to enhance your experience. Would you like to install Azure skills?" with Install, Not Now, and Don't Ask Again buttons](https://github.com/user-attachments/assets/b2ac7a0d-1f72-4af5-8cb5-a38f344a9244)

To manually install skills from the Command Palette, the following commands are available:

- `@azure: Install Azure Skills Globally` — installs to your home directory (for example `~` on macOS/Linux or `%UserProfile%` on Windows), available in all workspaces
- `@azure: Install Azure Skills Locally` — installs to the current workspace folder, workspace-scoped
- `@azure: Uninstall Azure Skills Globally` — removes globally installed skills

#### Copilot CLI

To install the Azure plugin into Copilot CLI and Claude:

1. Add the marketplace with `/plugin marketplace add microsoft/azure-skills`
2. Install the plugin with `/plugin install azure@azure-skills`
3. Update the plugin with `/plugin update azure@azure-skills`

## Sovereign Cloud Configuration

By default, the Azure MCP server connects to the Azure Public Cloud. If you use a sovereign cloud (Azure China Cloud or Azure US Government), you need to configure the MCP server to use the appropriate cloud environment.

### Copilot CLI

After installing the plugin from the marketplace, the skills are installed in `~/.copilot/installed-plugins/` on macOS/Linux (or `%USERPROFILE%\.copilot\installed-plugins\` on Windows). Edit the `<skill_installation_dir>/azure-skills/azure/.mcp.json` file in the installed plugin directory to add the `--cloud` argument:

> **Note:** If you are developing locally using `copilot --plugin-dir ./output`, edit `output/.mcp.json` in your local build output instead.

**Azure China Cloud:**

```json
{
  "mcpServers": {
    "azure": {
      "command": "npx",
      "args": ["-y", "@azure/mcp@latest", "server", "start", "--cloud", "AzureChinaCloud"]
    }
    // Keep the other MCP server configurations in this file as they are.
  }
}
```

**Azure US Government:**

```json
{
  "mcpServers": {
    "azure": {
      "command": "npx",
      "args": ["-y", "@azure/mcp@latest", "server", "start", "--cloud", "AzureUSGovernment"]
    }
    // Keep the other MCP server configurations in this file as they are.
  }
}
```

Before starting the MCP server, ensure your local CLI tools are authenticated against the correct cloud:

| Cloud | Azure CLI | Azure PowerShell | Azure Developer CLI |
|-------|-----------|-----------------|---------------------|
| China | `az cloud set --name AzureChinaCloud && az login` | `Connect-AzAccount -Environment AzureChinaCloud` | `azd config set cloud.name AzureChinaCloud && azd auth login` |
| US Government | `az cloud set --name AzureUSGovernment && az login` | `Connect-AzAccount -Environment AzureUSGovernment` | `azd config set cloud.name AzureUSGovernment && azd auth login` |

For more details, see [Connect to sovereign clouds](https://learn.microsoft.com/azure/developer/azure-mcp-server/how-to/connect-sovereign-clouds) in the Azure MCP Server documentation.

## Client Support Matrix

| Client | Skills | MCP Servers | Hooks | Marketplace | Manifest | Status |
|--------|:------:|:-----------:|:-----:|:-----------:|----------|--------|
| **Copilot CLI** | ✅ | ✅ | ✅ Custom (`plugin/hooks/copilot-hooks.json`) | ✅ `.plugin/` | `.plugin/plugin.json` | ✅ Onboarded |
| **Claude Code** | ✅ | ✅ | ✅ `hooks/hooks.json` (no custom hooks) | `.claude-plugin/marketplace.json` (exists only in azure-skills repo)| ✅ `plugin/.claude-plugin/plugin.json` | ✅ Onboarded |
| **VS Code Extension** | ✅ (`.agents` folder) | ✅ | ✅ `hooks/hooks.json` (`.agents` folder) | Extension-based | Extension-based | ✅ Onboarded |
| **IntelliJ** | ✅ (`.agents` folder) | ✅ | ❌ Not supported by client | Extension-based | Extension-based | ✅ Skills Onboarded 🔜 Hooks Support ETA - End of April 2026 |
| **Gemini CLI** | ✅ | ✅ | ❌ Not supported by us | No marketplace | `gemini-extension.json` | ✅ Onboarded|
| **Cursor** | ✅ | ✅ | `plugin/hooks/cursor-hooks.json` |  `.cursor-plugin/marketplace.json` (exists only in azure-skills repo) |  ✅ `plugin/.cursor-plugin/plugin.json` | ✅ Onboarded. Hooks testing - WIP |
| **Codex** | ✅ | ✅ | ❌ Not yet supported by client (currently supports Bash-only) | [Claude-style marketplace](https://developers.openai.com/codex/plugins/build?install-scope=workspace#add-a-marketplace-from-the-cli) | ✅ `plugin/.claude-plugin/plugin.json` | ✅ Onboarded as local plugin (curated marketplace requires public MCP) |
| **Eclipse** | ❌ Not supported by client | ✅ | ❌ Not supported by client | Extension-based | Extension-based | ⚠️ MCP only |

## Contributing

You can use this repository to:

* Upvote a feature or request a new one.
* Search for potential work-arounds to problems you’re having.
* Provide feedback on using GitHub Copilot for Azure.
* Add features to our Copilot CLI and Claude plugins.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on how to contribute, including local development setup.
