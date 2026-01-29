# Contributing to GitHub Copilot for Azure

Thank you for your interest in contributing to GitHub Copilot for Azure! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information, see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any questions or comments.

## Ways to Contribute

- **Report bugs** - File issues for bugs you encounter
- **Request features** - Suggest new features or improvements
- **Submit pull requests** - Contribute code, documentation, or skills
- **Create skills** - Build new Azure skills to extend functionality
- **Improve documentation** - Help make our docs clearer and more comprehensive

## Getting Started

### Prerequisites

Before contributing, ensure you have the following installed:

- [Git](https://git-scm.com/downloads)
- [Node.js 18+](https://nodejs.org) and NPM
- [GitHub Copilot CLI](https://github.com/github/copilot-cli)

### First-Time Setup

#### 1. Add the Plugin Marketplace

In GitHub Copilot CLI, add the plugin marketplace:

```
/plugin marketplace add microsoft/github-copilot-for-azure
```

#### 2. Install the Azure Plugin

Install the Azure plugin:

```
/plugin install azure@github-copilot-for-azure
```

---

## Local Development Setup

To develop and test skills locally, you'll need to link your cloned repository to the installed plugins folder. This allows you to make changes and see them reflected immediately without reinstalling the plugin.

### 1. Fork and Clone the Repository

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/GitHub-Copilot-for-Azure.git
cd GitHub-Copilot-for-Azure
```

### 2. Create a Symlink to the Plugin Folder

Create a symbolic link from your cloned repository's `plugin` folder to the Copilot installed plugins directory. This allows your local changes to be picked up immediately.

#### Windows (Command Prompt - Run as Administrator)

```cmd
mklink /J "%USERPROFILE%\.copilot\installed-plugins\github-copilot-for-azure" "D:\dev\GitHub-Copilot-for-Azure\plugin"
```

#### Windows (PowerShell - Run as Administrator)

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.copilot\installed-plugins\github-copilot-for-azure" -Target "D:\dev\GitHub-Copilot-for-Azure\plugin"
```

#### macOS / Linux

```bash
ln -s ~/dev/GitHub-Copilot-for-Azure/plugin ~/.copilot/installed-plugins/github-copilot-for-azure
```

> **Note:** Replace the paths above with your actual cloned repository location.

### 3. Verify the Symlink

Verify that the symlink was created correctly:

#### Windows (Command Prompt)
```cmd
dir "%USERPROFILE%\.copilot\installed-plugins"
```

#### Windows (PowerShell)
```powershell
Get-ChildItem "$env:USERPROFILE\.copilot\installed-plugins" | Format-List
```

#### macOS / Linux
```bash
ls -la ~/.copilot/installed-plugins/
```

You should see `github-copilot-for-azure` pointing to your cloned repository's `plugin` folder.

> **Note:** After making changes to skills or plugin files, you must restart GitHub Copilot CLI to pick up the new changes.

### 4. Remove an Existing Symlink (If Needed)

If you need to remove or recreate a symlink:

#### Windows (Command Prompt - Run as Administrator)
```cmd
rmdir "%USERPROFILE%\.copilot\installed-plugins\github-copilot-for-azure"
```

#### Windows (PowerShell - Run as Administrator)
```powershell
Remove-Item "$env:USERPROFILE\.copilot\installed-plugins\github-copilot-for-azure" -Force
```

#### macOS / Linux
```bash
rm ~/.copilot/installed-plugins/github-copilot-for-azure
```

### 5. Testing Pull Requests Locally

Once your symlink is set up, you can quickly test any open pull request by checking out its branch. This is especially useful during code review to verify changes work as expected.

#### Using GitHub CLI

Install the [GitHub CLI](https://cli.github.com/) if you haven't already, then run:

```bash
gh pr checkout <PR-NUMBER>
```

For example, to test PR #42:

```bash
gh pr checkout 42
```

This automatically:
1. Fetches the PR branch from the contributor's fork
2. Creates a local branch tracking the PR
3. Updates your symlinked plugin folder with the PR's changes

After checking out, restart GitHub Copilot CLI to pick up the changes and test the skill or feature.

#### Switching Back

To return to the main branch after testing:

```bash
git checkout main
```

> **Tip:** You can also use `gh pr checkout <PR-NUMBER> --force` to discard any local changes and switch to the PR branch.

---

## Contributing Skills

Skills are the core building blocks of GitHub Copilot for Azure. Each skill provides domain-specific knowledge and capabilities.

### Skill Structure

Skills are located under `plugin/skills/`. Each skill folder should contain:

```
plugin/skills/your-skill-name/
├── SKILL.md              # Main skill definition (required)
├── LICENSE.txt           # License file (if applicable)
├── references/           # Additional reference documentation
│   └── *.md
├── examples/             # Example code and templates
│   └── *
└── scripts/              # Helper scripts
    └── *
```

### Creating a New Skill

1. **Create your skill folder** under `plugin/skills/your-skill-name/`

2. **Write your SKILL.md** following the existing patterns in other skills

3. **Provide context** in your skill:
   - Links to relevant Azure documentation
   - Descriptions of MCP or command-line tools to include
   - Example use cases and scenarios

### Skill Guidelines

- Keep skills focused on a specific Azure service or capability
- Include practical examples and common use cases
- Reference official Microsoft documentation
- Test your skill thoroughly before submitting

---

## Submitting Changes

### Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit with clear, descriptive messages:
   ```bash
   git add .
   git commit -m "Add: Description of your changes"
   ```

3. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Open a Pull Request** against the `main` branch

5. **Address review feedback** and ensure all checks pass

### Commit Message Guidelines

Use clear, descriptive commit messages:

- `Add: New azure-cosmos-db skill`
- `Fix: Correct authentication example in plugin README`
- `Update: Improve Azure Functions deployment docs`
- `Remove: Deprecated references from skill`

### Pull Request Checklist

- [ ] Changes are tested locally
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages are clear and descriptive
- [ ] No breaking changes (or breaking changes are documented)
- [ ] Skills follow the established patterns

---

## Reporting Issues

### Before Filing an Issue

1. Search [existing issues](https://github.com/microsoft/GitHub-Copilot-for-Azure/issues) to avoid duplicates
2. Check the [Troubleshooting guide](./Troubleshooting.md)
3. Verify you're using the latest version

### Filing a Bug Report

Include the following information:

- **Description**: Clear description of the issue
- **Steps to Reproduce**: Numbered steps to reproduce the bug
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: OS, GitHub Copilot CLI version
- **Logs/Screenshots**: Any relevant error messages or screenshots

### Requesting Features

For feature requests, include:

- **Use Case**: Describe the problem you're trying to solve
- **Proposed Solution**: Your suggested approach
- **Alternatives**: Any alternatives you've considered

---

## Development Tips

### Testing Changes

After making changes to a skill:

1. Restart GitHub Copilot CLI to reload the plugin
2. Test the skill by asking relevant questions
3. Verify all referenced documentation and examples work

### Debugging

- Review the [Troubleshooting guide](./Troubleshooting.md) for common issues
- Use verbose logging when available

### Staying Updated

Keep your fork in sync with the upstream repository:

```bash
# Add upstream remote (one-time setup)
git remote add upstream https://github.com/microsoft/GitHub-Copilot-for-Azure.git

# Fetch and merge upstream changes
git fetch upstream
git checkout main
git merge upstream/main
```

---

## Questions?

- Check the [README](./README.md) for general information
- Review the [Troubleshooting guide](./Troubleshooting.md) for common issues
- Search or file [GitHub Issues](https://github.com/microsoft/GitHub-Copilot-for-Azure/issues)

Thank you for contributing to GitHub Copilot for Azure! 🚀
