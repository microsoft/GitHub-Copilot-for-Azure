# How to install Azure CLI on Linux

This document describes how to install Azure CLI on Linux to minimize issues during the setup phase.

## Azure CLI information

Azure CLI is a cross-platform command-line tool to connect to Azure and execute administrative commands on Azure resources. 

The default command for Azure CLI is `az`.

### Install via official script

Using the pre-written script is the recommended way to install Azure CLI because it handles a lot of the nuances.

Execute the command `curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash` to install Azure CLI. You can run `curl -sL https://aka.ms/InstallAzureCLIDeb` first to view the script to understand what it will do. This script uses apt so it will only work on Linux distributions that has apt installed.

### Install via manual script

You can manually run individual commands to install Azure CLI.

```bash
sudo apt-get update
sudo apt-get install apt-transport-https ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -sLS https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | sudo tee /etc/apt/keyrings/microsoft.gpg > /dev/null
sudo chmod go+r /etc/apt/keyrings/microsoft.gpg
'AZ_DIST=$(lsb_release -cs)'
'echo "Types: deb\nURIs: https://packages.microsoft.com/repos/azure-cli/\nSuites: ${AZ_DIST}\nComponents: main\nArchitectures: $(dpkg --print-architecture)\nSigned-by: /etc/apt/keyrings/microsoft.gpg" | sudo tee /etc/apt/sources.list.d/azure-cli.sources'
sudo apt-get update
sudo apt-get install azure-cli
```

Make as many modifications as you want to customize how Azure CLI will be installed.

## Verify installation

To verify installation of Azure CLI, you can execute `az version` which will list the version of the installed Azure CLI. If the installation is successful, the command will print the version.

## Documentation

[Official docs](https://learn.microsoft.com/cli/azure/)
