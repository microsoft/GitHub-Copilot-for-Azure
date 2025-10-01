# How to install Azure Functions Core Tools on Windows

This document describes how to install Azure Functions Core Tools on Windows to minimize issues during the setup phase.

## Azure Functions Core Tools information

Azure Functions Core Tools is a command-line tool for developing and testing Azure Functions locally.

The default command of Azure Functions Core Tools is `func`.

### Install via Microsoft Installer (MSI)

Download the MSI installer and run it to install the Azure Functions Core Tools.

- [64-bit Windows](https://go.microsoft.com/fwlink/?linkid=2174087)
- [32-bit Windows](https://go.microsoft.com/fwlink/?linkid=2174159)

## Verify installation

Run the command `func --version` to verify the version the installed Azure Functions Core Tools.

If you get a `'func' is not recognized` error, you can refresh the PATH environment variable by running this command.

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

## Documentation

[Official docs](https://learn.microsoft.com/azure/azure-functions/functions-run-local)