# How to install Azure Developer CLI on Linux

This document describes how to install Azure Developer CLI on Linux to minimize issues during the setup phase.

## Azure Developer CLI information

Azure Developer CLI is a cross-platform command-line tool that enables developers to provision and deploy Azure resources using infrastructure as code.

The default command for Azure Developer CLI is `azd`.

### Install via bash script

This method downloads the binary that matches your OS and processor and puts it to the installation location using a predefined script. This script can be rerun to upgrade the installed Azure Developer CLI.

```bash
curl -fsSL https://aka.ms/install-azd.sh | bash
```

## Verify installation

To verify installation of Azure Developer CLI, you can execute `azd version` which will list the version of the installed Azure Developer CLI. If the installation is successful, the command will print the version.

## Documentation

[Official docs](https://learn.microsoft.com/azure/developer/azure-developer-cli/)
