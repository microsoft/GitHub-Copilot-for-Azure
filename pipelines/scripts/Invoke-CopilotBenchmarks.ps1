param(
    [string]$BuildId
)



# Install MSBench CLI
Write-Host "Installing keyring"
pip install keyring artifacts-keyring

Write-Host "Listing key vaults in the resource group"
az keyvault list --resource-group rg-msbench-eval-kv-azure-mcp --query "[].name" -o tsv
