# How to install Azure Developer CLI on Windows

## Azure Developer CLI information

Azure Developer CLI is a cross-platform command-line tool that enables developers to provision and deploy Azure resources using infrastructure as code.

The default command for Azure Developer CLI is `azd`.

### Install via Windows Package Manager (WinGet)

Using the Windows Package Manager (WinGet) is the recommended method to install Azure Developer CLI on Windows. WinGet can automatically handle updates to Azure Developer CLI.

Execute the command `winget install microsoft.azd` to install Azure Developer CLI. 

WinGet will automatically update the PATH environment variable to include the path to the installed Azure Developer CLI.

### Install via PowerShell script

This method downloads the MSI installer file, runs it and deletes it after the installation using this PowerShell script

```powershell
powershell -ex AllSigned -c "Invoke-RestMethod \'https://aka.ms/install-azd.ps1\' | Invoke-Expression"'
```

You need to run PowerShell script as administrator to install Azure Developer CLI.

## Verify installation

To verify installation of Azure Developer CLI, you can execute `azd version` which will list the version of the installed Azure Developer CLI. If the installation is successful, the command will print the version.

If you are already in a terminal and you get the `'azd' is not recognized command` error, you can execute this command to refresh the PATH environment variable to include the path to the installed Azure Developer CLI. `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`

## Documentation

[Official docs](https://learn.microsoft.com/azure/developer/azure-developer-cli/)
