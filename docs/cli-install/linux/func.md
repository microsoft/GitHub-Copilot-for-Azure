# How to install Azure Functions Core Tools on Linux

## Azure Functions Core Tools information

Azure Functions Core Tools is a command-line tool for developing and testing Azure Functions locally.

The default command of Azure Functions Core Tools is `func`.

### Install via APT

Installing Azure Functions Core Tools via package manager APT is the recommended way. Use the following bash commands.

```bash
curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
sudo mv microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg
sudo sh -c 'echo \"deb [arch=amd64] https://packages.microsoft.com/repos/microsoft-ubuntu-$(lsb_release -cs 2>/dev/null)-prod $(lsb_release -cs 2>/dev/null) main\" > /etc/apt/sources.list.d/dotnetdev.list'
sudo apt-get update
sudo apt-get install azure-functions-core-tools-4
```

## Verify installation

Run the command `func --version` to verify the version the installed Azure Functions Core Tools.

## Documentation

[Official docs](https://learn.microsoft.com/azure/azure-functions/functions-run-local)