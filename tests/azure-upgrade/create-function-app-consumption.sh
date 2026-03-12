#!/bin/bash
# Passed validation in Cloud Shell on 2/28/2026

# For the recommended serverless plan, see create-function-app-flex-consumption.
# Function app and storage account names must be unique.

# Variable block
let "randomIdentifier=$RANDOM*$RANDOM"
location="eastus"
resourceGroup="rg-upgrade-test-$randomIdentifier"
storageAccount="stupgradetest$randomIdentifier"
functionAppName="func-upgrade-source-$randomIdentifier"
skuStorage="Standard_LRS"
functionsVersion="4"
runtime="node"
runtimeVersion="22"

# Create a resource group
echo "Creating resource group: $resourceGroup in $location..."
az group create --name $resourceGroup --location "$location"

# Create an Azure storage account in the resource group.
echo "Creating storage account: $storageAccount"
az storage account create --name $storageAccount --location "$location" --resource-group $resourceGroup --sku $skuStorage

# Create a Linux Consumption function app in the resource group.
echo "Creating consumption function app: $functionAppName"
az functionapp create --name $functionAppName --storage-account $storageAccount \
    --consumption-plan-location "$location" --resource-group $resourceGroup \
    --runtime $runtime --runtime-version $runtimeVersion \
    --functions-version $functionsVersion --os-type Linux

