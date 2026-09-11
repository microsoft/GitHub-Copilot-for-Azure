param location string

resource taggedFirst 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'sttagged1${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  tags: {
    foo: 'true'
  }
  properties: {
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

resource taggedSecond 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'sttagged2${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  tags: {
    foo: 'true'
  }
  properties: {
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

// Intentionally untagged. This is the resource the fixture expects the agent to find.
resource untagged 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'stuntagged${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

output taggedStorageAccountNames array = [taggedFirst.name, taggedSecond.name]
output untaggedStorageAccountName string = untagged.name
