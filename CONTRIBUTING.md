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
- **Follow the [Agent Skills Specification](https://agentskills.io/specification)**
- See [.github/skills/skill-authoring/SKILL.md](.github/skills/skill-authoring/SKILL.md) for detailed guidelines

### Token Management

#### Why Token Limits?

AI agents load skill content into their context window, which has finite capacity. Large skills:
- Consume context space needed for user conversations
- Slow down agent response times
- May get truncated, losing important instructions

The [agentskills.io specification](https://agentskills.io/specification) recommends keeping SKILL.md under 5000 tokens, with detailed content in `references/` directories that load on-demand.

#### Token Limits

| File Type | Soft Limit | Hard Limit | Action if Exceeded |
|-----------|------------|------------|-------------------|
| SKILL.md | 500 tokens | 5000 tokens | Move content to `references/` |
| references/*.md | 1000 tokens | 2000 tokens | Split into multiple files |
| docs/*.md | 1500 tokens | 3000 tokens | Restructure content |

Token estimation: **~4 characters = 1 token**

#### Commands

Run these from the repository root:

```bash
# First time setup (installs dependencies)
npm install

# Show help and available commands
npm run tokens help

# Count tokens in all markdown files
npm run tokens count

# Check all markdown files against token limits
npm run tokens check

# Get optimization suggestions
npm run tokens suggest                    # All files
npm run tokens suggest -- docs/           # Specific directory
npm run tokens suggest -- path/to/file.md # Specific file

# Compare token counts between git refs
npm run tokens compare                           # HEAD vs main
npm run tokens compare -- --base HEAD~1          # vs previous commit
npm run tokens compare -- --base feature-branch  # vs specific branch
```

**Example output from `npm run tokens compare`:**

```
📊 TOKEN CHANGE REPORT
══════════════════════════════════════════════════════════════════════
Comparing: main → HEAD
──────────────────────────────────────────────────────────────────────

📈 Total Change: +350 tokens (+5%)
   Before: 7,000 tokens
   After:  7,350 tokens
   Files:  3 modified, 1 added, 0 removed

Changed Files:
──────────────────────────────────────────────────────────────────────
🆕 plugin/skills/my-new-skill/SKILL.md
   0 → 450 tokens [+450 (+100%)]
📈 plugin/skills/existing-skill/SKILL.md
   500 → 600 tokens [+100 (+20%)]
```

**Example output from `npm run tokens check`:**

```
📊 Token Limit Check
════════════════════════════════════════════════════════════
Files Checked: 83
Files Exceeded: 5

⚠️  Files exceeding limits:
────────────────────────────────────────────────────────────
  ❌ plugin/skills/my-skill/SKILL.md
     850 tokens (limit: 500, over by 350)
     Pattern: SKILL.md

💡 Tip: Move detailed content to references/ subdirectories
```

#### CI Integration

Pull requests automatically run token analysis which includes:

1. **Token Comparison** - Shows token changes between your PR and the base branch
   - Total token increase/decrease with percentage
   - Per-file breakdown of changes
   - Highlights files with significant increases (>20%)

2. **Limit Check** - Warns if any files exceed their token limits

The bot will comment on your PR with a combined report. Address warnings by:

1. Moving detailed content to `references/` subdirectory
2. Using tables instead of verbose lists
3. Removing decorative elements (excessive emojis, redundant headers)
4. Linking to external documentation instead of duplicating it

See [markdown-token-optimizer](.github/skills/markdown-token-optimizer/SKILL.md) skill for optimization techniques.

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
