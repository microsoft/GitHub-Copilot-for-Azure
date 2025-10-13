# How to install Azure CLI on Windows

This document describes how to install Azure CLI on Windows to minimize issues during the setup phase.

## Azure CLI information

Azure CLI is a cross-platform command-line tool to connect to Azure and execute administrative commands on Azure resources. 

The default command for Azure CLI is `az`.

### Install via Windows Package Manager (WinGet)

Using the Windows Package Manager (WinGet) is the recommended method to install Azure CLI on Windows. WinGet can automatically handle updates to Azure CLI.

Execute the command `winget install -e --id Microsoft.AzureCLI` to install Azure CLI. 

WinGet will automatically update the PATH environment variable to include the path to the installed Azure CLI.

### Install via Microsoft Installer (MSI)

Download the MSI file from https://aka.ms/installazurecliwindowsx64 using a web browser. Run the downloaded installer from UI and follow the instructions to complete the installation.

### Install via PowerShell script

This method downloads the MSI installer file, runs it and deletes it after the installation using this PowerShell script

```powershell
$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri https://aka.ms/installazurecliwindowsx64 -OutFile .\\AzureCLI.msi; Start-Process msiexec.exe -Wait -ArgumentList '/I AzureCLI.msi /quiet'; Remove-Item .\\AzureCLI.msi
```

You need to run PowerShell script as administrator to install Azure CLI.

## Verify installation

To verify installation of Azure CLI, you can execute `az version` which will list the version of the installed Azure CLI. If the installation is successful, the command will print the version.

If you are already in a terminal and you get the `'az' is not recognized command` error, you can execute this command to refresh the PATH environment variable to include the path to the installed Azure CLI. `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`

## Documentation

[Official docs](https://learn.microsoft.com/cli/azure/)
