param(
    [string]$BuildId
)

Write-Host "Listing key vaults in the resource group"
az keyvault list --resource-group rg-msbench-eval-kv-azure-mcp --query "[].name" -o tsv
