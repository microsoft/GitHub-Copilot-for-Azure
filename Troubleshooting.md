# GitHub Copilot for Azure Troubleshooting Guide

## Best Practices for Using GitHub Copilot for Azure

Follow these best practices to maximize your experience with GitHub Copilot for Azure. If you encounter issues, these guidelines can help resolve common problems.

- **Ask about capabilities**: Query the agent about its capabilities in detail. If you receive unexpected results or the agent can't help with your request, verify whether the capability is supported. You can then submit a feature request for missing capabilities or file a bug report for supported features that aren't working correctly.

- **Monitor tool invocations**: When the agent invokes a tool, you can view the input parameters and output by expanding the tool invocation status UI in VS Code. Monitor these invocations to ensure the agent is working correctly. If you notice issues, prompt to help the agent resolve them.

- **Add context when needed**: Use the `Add Context` button in the chat window to provide additional information. If the agent seems to be missing key context while handling your request, add relevant context to guide its understanding.

- **Request explanations**: Ask the agent to explain its reasoning when helping with your request. When you receive unexpected results, this can help you understand the agent's decision-making process. You can then prompt to correct any misunderstandings to improve the agent's behavior.

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
