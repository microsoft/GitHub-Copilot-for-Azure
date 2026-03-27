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

To manually install skills from the Command Palette the following commands are available:

- `@azure: Install Azure Skills Globally` — installs to `~`, available in all workspaces
- `@azure: Install Azure Skills Locally` — installs to CWD, workspace-scoped
- `@azure: Uninstall Azure Skills Globally` — removes globally installed skills

#### Copilot CLI

To install the Azure plugin into Copilot CLI and Claude:

1. Add the marketplace with `/plugin marketplace add microsoft/azure-skills`
2. Install the plugin with `/plugin install azure@azure-skills`
3. Update the plugin with `/plugin update azure@azure-skills`

## Contributing

You can use this repository to:

* Upvote a feature or request a new one.
* Search for potential work-arounds to problems you’re having.
* Provide feedback on using GitHub Copilot for Azure.
* Add features to our Copilot CLI and Claude plugins.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on how to contribute, including local development setup.
