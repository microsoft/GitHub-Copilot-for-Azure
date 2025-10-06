# GitHub Copilot for Azure Troubleshooting Guide

## Best Practices for Using GitHub Copilot for Azure

Follow these best practices to maximize your experience with GitHub Copilot for Azure. If you encounter issues, these guidelines can help resolve common problems.

- **Ask about capabilities**: In both Ask mode and Agent mode, you can query the agent about its capabilities in detail. If you receive unexpected results or the agent can't help with your request, verify whether the capability is supported. You can then submit a feature request for missing capabilities or file a bug report for supported features that aren't working correctly.

- **Monitor tool invocations**: In Agent mode, when the agent invokes a tool, you can view the input parameters and output by expanding the tool invocation status UI in VS Code. Monitor these invocations to ensure the agent is working correctly. If you notice issues, prompt to help the agent resolve them.

- **Add context when needed**: In both Ask mode and Agent mode, you can use the `Add Context` button in the chat window to provide additional information. If the agent seems to be missing key context while handling your request, add relevant context to guide its understanding.

- **Request explanations**: In both Ask mode and Agent mode, you can ask the agent to explain its reasoning when helping with your request. When you receive unexpected results, this can help you understand the agent's decision-making process. You can then prompt to correct any misunderstandings to improve the agent's behavior.

## CLI Tool Dependencies

GitHub Copilot for Azure relies on external CLI tools for various operations. For example, after generating Azure CLI commands (`az`), VS Code needs access to the Azure CLI to execute them. Similarly, the extension may invoke Azure Developer CLI commands (`azd`) to deploy resources to Azure. Follow these guidelines to ensure optimal performance:

- **Ensure consistent authentication**: Verify that both the CLI tools and the GitHub Copilot for Azure extension are signed in to the same Microsoft account and scoped to the same Azure tenant and subscription. If you're unsure about the current tenant or subscription scope, ask GitHub Copilot for Azure directly.

- **Review commands before execution**: Always inspect generated commands before running them in the terminal. While GitHub Copilot for Azure's CLI command generation is optimized to minimize errors, mistakes can still occur. Verify that commands perform the intended actions before execution.

## Collecting Information for Troubleshooting

When reporting issues, providing detailed information helps us understand and resolve problems more effectively. Use these methods to gather relevant troubleshooting data:

- **Extension logs**: The extension writes logs to its VS Code output channel. To collect these logs:
  1. Press <kbd>F1</kbd> in VS Code and run the `@azure: Show output channel` command
  2. Copy relevant messages from the GitHub Copilot for Azure output channel
  3. **Important**: Redact any private or sensitive information before submitting
  
  For more detailed logs, you may need to increase the verbosity level:
  1. Press <kbd>F1</kbd> and run `Developer: Set Log Level`
  2. Select `Trace` from the dropdown menu
  3. Reproduce the issue and collect logs from the output window
  4. **Optional**: Set the log level back to default `Info` level

- **Tool invocation details**: In GitHub Copilot Agent Mode, the agent may invoke extension tools that produce unexpected results. You can access detailed information by expanding the tool invocation status UI in VS Code. When reporting issues, include:
  - The original prompt that triggered the invocation
  - The input parameters the agent generated from your prompt
  - The tool's output
  
  **Important**: Remove any private or sensitive data from prompts, inputs, and outputs before sharing.

## Known Issues and Resolutions

This section covers common issues that users may encounter while using GitHub Copilot for Azure and their recommended resolutions.

### Corrupted Installation - Missing Files

**Issue**: GitHub Copilot for Azure fails to load or certain features don't work due to missing or corrupted extension files. This may manifest as:
- Extension fails to activate properly
- Error messages about missing files
- Error message about the operating system and processor architecture is not supported even though it should be.

**Resolution**: 
1. **Uninstall the extension**:
   - Open the Extensions view in VS Code (<kbd>Ctrl+Shift+X</kbd> or <kbd>Cmd+Shift+X</kbd>)
   - Find "GitHub Copilot for Azure" in your installed extensions
   - Click the gear icon and select "Uninstall"

3. **Reinstall the extension**:
   - Restart VS Code
   - Go to the Extensions view
   - Search for "GitHub Copilot for Azure"
   - Install the extension from Microsoft

4. **Verify the installation**:
   - Restart VS Code after installation
   - Test basic functionality by asking a simple Azure question

If the issue persists after following these steps, you may want to inspect the installed files to see which files are missing. In VS Code, press <kbd>F1</kbd> and run the `Extensions: Open Extensions Folder` command. This will open the directory where all the extensions are installed. Navigate into `ms-azuretools.vscode-azure-github-copilot-{version}-{os}-{arch}` > `dist` > `node_modules` > `aidriver.{os}.{arch}`, collect the file names of files in this directory and share with us so we can compare and find out which ones are missing.

### Error message "spawn EPERM"

**Issue**: GitHub Copilot for Azure fails to activate because the system prevents one of its processes from starting. This usually manifests with the error message "spawn EPERM".

**Resolution**:
1. **Confirm the issue**:
   - Using the steps in "Collecting Information for troubleshooting" (above) find the path to the executable GitHub Copilot for Azure is trying to start.
   - Open a terminal and try to start the executable manually.
   - If the process fails to start with a permission or authorization issue, proceed to step 2. Otherwise, proceed to step 3.

2. **Contact your system administrator**
   - If the error occurs on a Windows system, it is likely the executable is being blocked by a system policy.
   - Contact your system administrator about adjusting the policy to allow the executable to run.
  
3. **Collect more information and file an issue**
   - If the executable runs when manually started in the terminal, or you are not running Windows, collect the information in "Collecting Information for troubleshooting" (above).
   - File an issue in this repo with the collected information.
