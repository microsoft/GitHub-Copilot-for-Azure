// This file has intentional syntax errors for testing

param location string = 'eastus'
param name string

// Missing closing brace
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: name
  location: location
  // Unclosed interpolation
  tags: {
    env: '${location'
  }
