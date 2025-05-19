# Issue Title Update Instructions

This document explains the changes made to improve issue titles for clarity and how to apply them.

## Summary of Changes

The following issue titles have been updated for clarity and specificity:

1. Issue #321: 
   - From: "spawn UNKNOWN"
   - To: "Error: 'spawn UNKNOWN' when activating extension in VS Code on Windows"

2. Issue #319:
   - From: "The SSL connection could not be established"
   - To: "Plugin fails with 'SSL connection could not be established' during Azure best practices invocation"

3. Issue #318:
   - From: "Error Message: This operating system and architecture is not supported by the GitHub Copilot"
   - To: "Extension reports 'operating system and architecture not supported' error"

4. Issue #314:
   - From: "github copilot not working in vscode"
   - To: "Error: 'EPERM' when activating GitHub Copilot for Azure extension in VS Code on Windows"

5. Issue #297:
   - From: "FAiled to install Github Copilor for Azure"
   - To: "Failed to acquire .NET runtime when installing GitHub Copilot for Azure on macOS"

6. Issue #271:
   - From: "Copilot chat tried to install Github Copilot for Azure and failed"
   - To: "Failed to load System.Private.CoreLib.dll during GitHub Copilot for Azure installation on Windows"

## How to Apply the Changes

A GitHub workflow has been created to automate the updating process. To apply these changes:

1. Navigate to the Actions tab in the GitHub repository
2. Find the "Update Specific Issue Titles" workflow
3. Click "Run workflow"
4. In the confirmation field, type "yes" and then click the "Run workflow" button

The workflow will update all six issue titles to the improved versions.

## Benefits of Clear Issue Titles

1. **Improved Searchability**: More specific titles make it easier for users to find similar issues
2. **Better Prioritization**: Clear descriptions help maintainers understand the severity and context
3. **Faster Resolution**: Technical details in the title allow developers to quickly assess if they can help
4. **Consistent Format**: Following a pattern of "Error type: specific error message on platform" makes issues more scannable

## Guidelines for Future Issue Titles

For future issues, consider including these elements in the title:
- Error type (if applicable)
- Specific error message in quotes
- Context (during installation, activation, etc.)
- Platform information (Windows, macOS, etc.)