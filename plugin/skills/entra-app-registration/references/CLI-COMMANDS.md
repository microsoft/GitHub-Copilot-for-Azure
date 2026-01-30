# Azure CLI Commands for App Registration

## Create App

```bash
# Web app
az ad app create --display-name "MyApp" --web-redirect-uris "https://app.com/callback" --sign-in-audience "AzureADMyOrg"

# SPA
az ad app create --display-name "MySPA" --spa-redirect-uris "http://localhost:3000"

# Public client (Desktop/Mobile)
az ad app create --display-name "MyDesktop" --public-client-redirect-uris "http://localhost"

# Multi-tenant
az ad app create --display-name "MyMultiTenant" --sign-in-audience "AzureADMultipleOrgs"
```

**Audiences:** `AzureADMyOrg`, `AzureADMultipleOrgs`, `AzureADandPersonalMicrosoftAccount`

## Query Apps

```bash
az ad app list --display-name "MyApp" -o table
az ad app show --id $APP_ID
APP_ID=$(az ad app list --display-name "MyApp" --query "[0].appId" -o tsv)
```

## Update & Redirect URIs

```bash
az ad app update --id $APP_ID --web-redirect-uris "https://app.com/auth"
az ad app update --id $APP_ID --spa-redirect-uris "http://localhost:3000"
```

## Client Secrets

```bash
az ad app credential reset --id $APP_ID --years 1    # Create (saves all details)
az ad app credential list --id $APP_ID               # List
az ad app credential delete --id $APP_ID --key-id KEY_ID  # Delete
```

⚠️ Reset deletes existing credentials. Secret shown only once.

## API Permissions

```bash
GRAPH="00000003-0000-0000-c000-000000000000"

# Add delegated permission (Scope)
az ad app permission add --id $APP_ID --api $GRAPH --api-permissions "e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope"

# Add application permission (Role)
az ad app permission add --id $APP_ID --api $GRAPH --api-permissions "df021288-bdef-4463-88db-98f22de89214=Role"

# Grant admin consent
az ad app permission admin-consent --id $APP_ID
```

**Common Graph Permission IDs:**

| Permission | ID | Type |
|------------|-----|------|
| User.Read | e1fe6dd8-ba31-4d61-89e7-88639da4683d | Delegated |
| Mail.Read | 570282fd-fa5c-430d-a7fd-fc8dc98a9dca | Delegated |
| User.Read.All | df021288-bdef-4463-88db-98f22de89214 | Application |

## Service Principal

```bash
az ad sp create --id $APP_ID      # Create
az ad sp show --id $APP_ID        # Show
az ad sp delete --id $APP_ID      # Delete
```

## Complete Setup Script

```bash
APP_NAME="MyApp"; REDIRECT="http://localhost:3000"
APP_ID=$(az ad app create --display-name "$APP_NAME" --spa-redirect-uris "$REDIRECT" --query "appId" -o tsv)
az ad app permission add --id $APP_ID --api 00000003-0000-0000-c000-000000000000 --api-permissions "e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope"
az ad app permission admin-consent --id $APP_ID
az ad sp create --id $APP_ID
echo "App ID: $APP_ID | Tenant: $(az account show --query tenantId -o tsv)"
```

## Delete App

```bash
az ad app delete --id $APP_ID
```
