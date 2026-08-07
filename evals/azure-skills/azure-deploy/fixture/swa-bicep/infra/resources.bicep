param location string
param name string

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: name
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
}

output WEB_URL string = 'https://${staticWebApp.properties.defaultHostname}'
