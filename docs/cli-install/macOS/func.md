# How to install Azure Functions Core Tools on macOS

## Azure Functions Core Tools information

Azure Functions Core Tools is a command-line tool for developing and testing Azure Functions locally.

The default command of Azure Functions Core Tools is `func`.

### Install via Homebrew

Installing Azure Functions Core Tools via package manager Homebrew is the recommended way. Use the following bash commands:

```bash
brew tap azure/functions
brew install azure-functions-core-tools@4
```

If you have installed Azure Functions Core Tools v2.x or v3.x before, you can use this command to overwrite the symlink for `func` to point to the new entry point.

```bash
brew link --overwrite azure-functions-core-tools@4
```

## Verify installation

Run the command `func --version` to verify the version the installed Azure Functions Core Tools.

## Documentation

[Official docs](https://learn.microsoft.com/azure/azure-functions/functions-run-local)