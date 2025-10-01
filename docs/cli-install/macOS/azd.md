# How to install Azure Developer CLI on macOS

This document describes how to install Azure Developer CLI on macOS to minimize issues during the setup phase.

## Azure Developer CLI information

Azure Developer CLI is a cross-platform command-line tool that enables developers to provision and deploy Azure resources using infrastructure as code.

The default command for Azure Developer CLI is `azd`.

### Install via Homebrew

Using the package manger Homebrew is the recommended method to install Azure Developer CLI on macOS. Homebrew can automatically handle updates to Azure Developer CLI.

Execute the command `brew tap azure/azd && brew install azd` to install Azure Developer CLI. For upgrading, use `brew upgrade azd`.

Homebrew will automatically update the PATH environment variable to include the path to the installed Azure Developer CLI.

If your process is Apple silicon (M1/M2), Rosetta 2 will be required.

### Install via bash script

This method downloads the binary that matches your OS and processor and puts it to the installation location using a predefined script. This script can be rerun to upgrade the installed Azure Developer CLI.

```bash
curl -fsSL https://aka.ms/install-azd.sh | bash
```

## Verify installation

To verify installation of Azure Developer CLI, you can execute `azd version` which will list the version of the installed Azure Developer CLI. If the installation is successful, the command will print the version.

## Documentation

[Official docs](https://learn.microsoft.com/azure/developer/azure-developer-cli/)
