# GitHub Workflows

This directory contains GitHub Actions workflows for automating repository maintenance tasks.

## Available Workflows

### add-untriaged-label.yml
Automatically adds the "untriaged" label to newly opened issues.

### info-needed-closer.yml
Handles issues that need more information from the submitter.

### update-issue-titles.yml
Updates specific issue titles for clarity and better searchability. 
This is a manual workflow that requires explicit confirmation before executing.

See the [issue title update instructions](/docs/issue-title-update-instructions.md) for more details on the changes made to issue titles.

## Running Workflows

Manual workflows can be triggered from the Actions tab in the GitHub repository interface.