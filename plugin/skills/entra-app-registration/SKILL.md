---
name: entra-app-registration
description: Expert in Microsoft Entra app registration. Help with understanding OAuth protocol, Entra concepts, creating the first Entra app registration and integrating OAuth flow in an example console application.
---

# Microsoft Entra App Registration

This skill helps users understand and implement Microsoft Entra ID (formerly Azure AD) app registrations, OAuth 2.0 authentication flows, and integrate identity services into applications.

## Skill Activation Triggers

**Use this skill immediately when the user asks to:**
- "Create an Entra app registration"
- "Set up OAuth authentication for my application"
- "How do I authenticate users with Azure AD?"
- "Register my application with Microsoft Entra ID"
- "Configure app registration for my console/web/mobile app"
- "Set up client credentials flow"
- "Implement authorization code flow"
- "What are Entra app permissions?"
- "How do I get an access token from Azure AD?"
- "Set up single sign-on (SSO) with Entra ID"
- "Configure API permissions for my app"
- "Create a service principal for authentication"

**Key Indicators:**
- Mentions "Entra", "Azure AD", "AAD", "app registration"
- OAuth 2.0 or OpenID Connect implementation questions
- Authentication/authorization setup for Azure services
- Access token, client ID, client secret, or tenant ID references
- Questions about Microsoft identity platform

## Overview

Microsoft Entra ID (formerly Azure Active Directory) is Microsoft's cloud-based identity and access management service. App registrations allow applications to authenticate users and access Azure resources securely.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **App Registration** | Configuration that allows an app to use Microsoft identity platform |
| **Application (Client) ID** | Unique identifier for your application |
| **Tenant ID** | Unique identifier for your Azure AD tenant/directory |
| **Client Secret** | Password for the application (confidential clients only) |
| **Redirect URI** | URL where authentication responses are sent |
| **API Permissions** | Access scopes your app requests |
| **Service Principal** | Identity created in your tenant when you register an app |

### Application Types

| Type | Use Case | Authentication Flow |
|------|----------|-------------------|
| **Web Application** | Server-side apps, APIs | Authorization Code Flow |
| **Single Page App (SPA)** | JavaScript/React/Angular apps | Authorization Code Flow with PKCE |
| **Mobile/Native App** | Desktop, mobile apps | Authorization Code Flow with PKCE |
| **Daemon/Service** | Background services, APIs | Client Credentials Flow |

## Core Workflow

### Step 1: Register the Application

Create an app registration in the Azure portal or using Azure CLI.

**Portal Method:**
1. Navigate to Azure Portal → Microsoft Entra ID → App registrations
2. Click "New registration"
3. Provide name, supported account types, and redirect URI
4. Click "Register"

**CLI Method:** See [references/CLI-COMMANDS.md](references/CLI-COMMANDS.md)

### Step 2: Configure Authentication

Set up authentication settings based on your application type.

- **Web Apps**: Add redirect URIs, enable ID tokens if needed
- **SPAs**: Add redirect URIs, enable implicit grant flow if necessary
- **Mobile/Desktop**: Use `http://localhost` or custom URI scheme
- **Services**: No redirect URI needed for client credentials flow

### Step 3: Configure API Permissions

Grant your application permission to access Microsoft APIs or your own APIs.

**Common Microsoft Graph Permissions:**
- `User.Read` - Read user profile
- `User.ReadWrite.All` - Read and write all users
- `Directory.Read.All` - Read directory data
- `Mail.Send` - Send mail as a user

**Details:** See [references/API-PERMISSIONS.md](references/API-PERMISSIONS.md)

### Step 4: Create Client Credentials (if needed)

For confidential client applications (web apps, services), create a client secret or certificate.

**Client Secret:**
- Navigate to "Certificates & secrets"
- Create new client secret
- Copy the value immediately (only shown once)
- Store securely (Key Vault recommended)

**Certificate:** For production environments, use certificates instead of secrets for enhanced security. Upload certificate via "Certificates & secrets" section.

### Step 5: Implement OAuth Flow

Integrate the OAuth flow into your application code.

**See:**
- [references/OAUTH-FLOWS.md](references/OAUTH-FLOWS.md) - OAuth 2.0 flow details
- [references/CONSOLE-APP-EXAMPLE.md](references/CONSOLE-APP-EXAMPLE.md) - Console app implementation

## OAuth 2.0 Flows

### Authorization Code Flow (Web Apps)

**When to use:** Server-side web applications

**Flow:**
1. Redirect user to Microsoft login
2. User authenticates and consents
3. Authorization code returned to redirect URI
4. Exchange code for access token
5. Use token to call APIs

**Example:** See [references/OAUTH-FLOWS.md#authorization-code-flow](references/OAUTH-FLOWS.md#authorization-code-flow)

---

### Authorization Code Flow with PKCE (SPAs, Mobile)

**When to use:** Single-page apps, mobile/desktop apps

**Flow:**
1. Generate code verifier and challenge
2. Request authorization code with challenge
3. Exchange code + verifier for token
4. Use token to call APIs

**Why PKCE:** Prevents authorization code interception attacks

**Example:** See [references/OAUTH-FLOWS.md#authorization-code-flow-with-pkce](references/OAUTH-FLOWS.md#authorization-code-flow-with-pkce)

---

### Client Credentials Flow (Services)

**When to use:** Daemon apps, background services, API-to-API calls

**Flow:**
1. Application authenticates with client ID + secret
2. Receives access token
3. Uses token to call APIs (application permissions)

**Note:** No user context; app acts on its own behalf

**Example:** See [references/OAUTH-FLOWS.md#client-credentials-flow](references/OAUTH-FLOWS.md#client-credentials-flow)

---

### Device Code Flow (Headless Devices)

**When to use:** IoT devices, CLI tools, devices without browsers

**Flow:**
1. Request device code
2. Show code to user
3. User logs in on another device
4. Poll for token
5. Receive access token after user completes authentication

**Example:** See [references/OAUTH-FLOWS.md#device-code-flow](references/OAUTH-FLOWS.md#device-code-flow)

## Common Patterns

### Pattern 1: First-Time App Registration

Walk user through their first app registration step-by-step.

**Required Information:**
- Application name
- Application type (web, SPA, mobile, service)
- Redirect URIs (if applicable)
- Required permissions

**Script:** See [references/FIRST-APP-REGISTRATION.md](references/FIRST-APP-REGISTRATION.md)

---

### Pattern 2: Console Application with User Authentication

Create a .NET/Python/Node.js console app that authenticates users.

**Required Information:**
- Programming language (C#, Python, JavaScript, etc.)
- Authentication library (MSAL recommended)
- Required permissions

**Example:** See [references/CONSOLE-APP-EXAMPLE.md](references/CONSOLE-APP-EXAMPLE.md)

---

### Pattern 3: Service-to-Service Authentication

Set up daemon/service authentication without user interaction.

**Required Information:**
- Service/app name
- Target API/resource
- Whether to use secret or certificate

**Implementation:** Use Client Credentials flow (see [references/OAUTH-FLOWS.md#client-credentials-flow](references/OAUTH-FLOWS.md#client-credentials-flow))

---

### Pattern 4: Multi-Tenant Applications

Configure app registration to work across multiple Azure AD tenants.

**Account Types:**
- Single tenant (default)
- Multi-tenant (any Azure AD)
- Multi-tenant + personal Microsoft accounts

**Considerations:** Tenant consent, per-tenant service principals. Configure in Azure Portal under Authentication → Supported account types.

---

### Pattern 5: Troubleshooting Authentication Issues

Diagnose and fix common app registration and OAuth errors.

**Common Errors:**
- `AADSTS7000215`: Invalid client secret
- `AADSTS50011`: Redirect URI mismatch
- `AADSTS65001`: User/admin consent required
- `AADSTS700016`: Application not found in tenant
- `AADSTS90014`: Missing required field

**Diagnostic Steps:** See [references/TROUBLESHOOTING.md](references/TROUBLESHOOTING.md)

## MCP Tools and CLI

### Azure CLI Commands

| Command | Purpose |
|---------|---------|
| `az ad app create` | Create new app registration |
| `az ad app list` | List app registrations |
| `az ad app show` | Show app details |
| `az ad app permission add` | Add API permission |
| `az ad app credential reset` | Generate new client secret |
| `az ad sp create` | Create service principal |

**Complete reference:** See [references/CLI-COMMANDS.md](references/CLI-COMMANDS.md)

### Microsoft Authentication Library (MSAL)

MSAL is the recommended library for integrating Microsoft identity platform.

**Supported Languages:**
- .NET/C# - `Microsoft.Identity.Client`
- JavaScript/TypeScript - `@azure/msal-browser`, `@azure/msal-node`
- Python - `msal`
- Java - `msal4j`
- iOS - `MSAL`
- Android - `MSAL`

**Examples:** See [references/CONSOLE-APP-EXAMPLE.md](references/CONSOLE-APP-EXAMPLE.md)

## Security Best Practices

| Practice | Recommendation |
|----------|---------------|
| **Never hardcode secrets** | Use environment variables, Azure Key Vault, or managed identity |
| **Rotate secrets regularly** | Set expiration, automate rotation |
| **Use certificates over secrets** | More secure for production |
| **Least privilege permissions** | Request only required API permissions |
| **Enable MFA** | Require multi-factor authentication for users |
| **Use managed identity** | For Azure-hosted apps, avoid secrets entirely |
| **Validate tokens** | Always validate issuer, audience, expiration |
| **Use HTTPS only** | All redirect URIs must use HTTPS (except localhost) |
| **Monitor sign-ins** | Use Entra ID sign-in logs for anomaly detection |

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Redirect URI mismatch | URI not registered or doesn't match exactly | Add exact URI in app registration |
| Invalid client secret | Secret expired or incorrect | Generate new secret, update app config |
| Insufficient privileges | App lacks required permissions | Add permissions, grant admin consent |
| Token expired | Access tokens expire (typically 1 hour) | Implement token refresh logic |
| Tenant not found | Wrong tenant ID | Verify tenant ID in Azure Portal |
| CORS errors (SPA) | Browser blocking cross-origin requests | Configure allowed origins in app registration |
| App not multi-tenant | Trying to authenticate users from other tenants | Change to multi-tenant in Authentication settings |

## Quick Start Example

Here's a minimal example to get started with a console app:

### 1. Create App Registration
```bash
# Using Azure CLI
az ad app create --display-name "MyConsoleApp" \
  --sign-in-audience "AzureADMyOrg" \
  --public-client-redirect-uris "http://localhost"
```

### 2. Get Application Details
```bash
# Get Application (Client) ID
az ad app list --display-name "MyConsoleApp" --query "[0].appId" -o tsv

# Get Tenant ID
az account show --query tenantId -o tsv
```

### 3. Implement Authentication
See [references/CONSOLE-APP-EXAMPLE.md](references/CONSOLE-APP-EXAMPLE.md) for complete code examples in C#, Python, and JavaScript.

## References

- [OAuth Flows](references/OAUTH-FLOWS.md) - Detailed OAuth 2.0 flow explanations
- [CLI Commands](references/CLI-COMMANDS.md) - Azure CLI reference for app registrations
- [Console App Example](references/CONSOLE-APP-EXAMPLE.md) - Complete working examples
- [First App Registration](references/FIRST-APP-REGISTRATION.md) - Step-by-step guide for beginners
- [API Permissions](references/API-PERMISSIONS.md) - Understanding and configuring permissions
- [Troubleshooting](references/TROUBLESHOOTING.md) - Common issues and solutions

## External Resources

- [Microsoft Identity Platform Documentation](https://learn.microsoft.com/en-us/entra/identity-platform/)
- [OAuth 2.0 and OpenID Connect protocols](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols)
- [MSAL Documentation](https://learn.microsoft.com/en-us/entra/msal/)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/)
