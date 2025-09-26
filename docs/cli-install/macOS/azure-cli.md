# How to install Azure CLI on macOS

This document describes how to install Azure CLI on macOS to minimize issues during the setup phase.

## Azure CLI information

Azure CLI is a Cross-platform command-line tool to connect to Azure and execute administrative commands on Azure resources. 

The default command for Azure CLI is "az".

### Install via Homebrew package manager

Using the Homebrew package manager is the recommended method to install Azure CLI. Homebrew can automatically handle updates to Azure CLI.

If you don't already have Homebrew installed, you can install it from "https://brew.sh".

Execute the command `brew update && brew install azure-cli` to install Azure CLI. 

Homebrew will automatically update the PATH environment variable to include the path to the installed Azure CLI.

## Verify installation

To verify installation of Azure CLI, you can execute "az version" which will list the version of the installed Azure CLI. If the installation is successful, the command will print the version.

If you are already in a terminal and you get the `'az' command not found` error, you can manually add the `/opt/homebrew/bin` to the PATH environment variable.