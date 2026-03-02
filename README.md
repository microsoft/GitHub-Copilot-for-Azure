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
`Failed to add marketplace: Failed to fetch GitHub marketplace microsoft/github-copilot-for-azure: Error: spawn git ENOENT`

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

To install the Azure plugin into Copilot CLI and Claude:

1. Add the marketplace with `/plugin marketplace add microsoft/github-copilot-for-azure`
2. Install the plugin with `/plugin install azure@github-copilot-for-azure`
3. Update the plugin with `/plugin update azure@github-copilot-for-azure`

## Contributing

You can use this repository to:

* Upvote a feature or request a new one.
* Search for potential work-arounds to problems you’re having.
* Provide feedback on using GitHub Copilot for Azure.
* Add features to our Copilot CLI and Claude plugins.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on how to contribute, including local development setup.
