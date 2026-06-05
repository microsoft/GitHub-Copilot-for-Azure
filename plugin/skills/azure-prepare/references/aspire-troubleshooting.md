# Aspire Troubleshooting

## Non-interactive `azd init` prompts

- `no default response for prompt 'Enter a unique environment name:'` → include `-e <environment-name>`.
- `no default response for prompt 'How do you want to initialize your app?'` → include `--from-code`.

```bash
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"
azd init --from-code -e "$ENV_NAME"
```

## No AppHost detected

1. Verify AppHost project exists: `find . -name "*.AppHost.csproj"`
2. Check project builds: `dotnet build`
3. Ensure Aspire.Hosting is referenced by the AppHost project.

## Unsupported resource type

If manifest generation fails with `unsupported resource type`, the AppHost contains custom Aspire resources that azd cannot deploy.

1. Do **not** modify source code to add `.ExcludeFromManifest()` or otherwise suppress the error.
2. Do **not** proceed with deployment.
3. Record a blocker: "AppHost contains custom Aspire resource types not supported for Azure deployment."
4. Tell the user the application targets local development or custom tooling, not Azure deployment.

## Azure Functions secret storage

When Aspire Functions use `.WithHostStorage(storage)`, Azure Functions secret/key management cannot use identity-based storage URIs. Before `azd up`, add file-based secret storage:

```csharp
var functions = builder.AddAzureFunctionsProject<Projects.MyFunctions>("functions")
    .WithHostStorage(storage)
    .WithEnvironment("AzureWebJobsSecretStorageType", "Files");
```

If generated infrastructure must be edited directly, ensure the Functions container app has:

```bicep
{
  name: 'AzureWebJobsSecretStorageType'
  value: 'Files'
}
```

## Wrong subscription

The Azure CLI and azd keep separate contexts. After `azd init --from-code`, immediately run:

```bash
./scripts/set-azd-context.sh <user-confirmed-subscription-id> <location> <environment-name>
```

Use the PowerShell helper on Windows:

```powershell
.\scripts\set-azd-context.ps1 -SubscriptionId <subscription-id> -Location <location> -EnvironmentName <environment-name>
```
