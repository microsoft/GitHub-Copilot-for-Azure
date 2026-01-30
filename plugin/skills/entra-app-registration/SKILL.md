---
name: entra-app-registration
description: Expert in Microsoft Entra app registration. Use this skill to help with understanding OAuth protocol, Entra concepts, creating the first Entra app registration and integrating OAuth flow in an example console application.
---

## Overview

Microsoft Entra ID is Microsoft's cloud-based identity and access management service. App registrations allow applications to authenticate users and access Azure resources securely.

## When to Use

- Creating or configuring app registrations
- Setting up OAuth authentication flows
- Troubleshooting authentication errors
- Managing API permissions and client credentials

## Key CLI Commands

```bash
az ad app create --display-name "MyApp"           # Create app
az ad app list --display-name "MyApp"             # Find app
az ad app credential reset --id $APP_ID           # Create secret
az ad app permission add --id $APP_ID --api ...   # Add permission
az ad app permission admin-consent --id $APP_ID   # Grant consent
az ad sp create --id $APP_ID                      # Create service principal
```

## References

- [First App Registration](references/FIRST-APP-REGISTRATION.md) - Step-by-step beginner guide
- [CLI Commands](references/CLI-COMMANDS.md) - Complete Azure CLI reference
- [OAuth Flows](references/OAUTH-FLOWS.md) - OAuth 2.0 flow explanations
- [API Permissions](references/API-PERMISSIONS.md) - Permission configuration
- [Console App Example](references/CONSOLE-APP-EXAMPLE.md) - Working code examples
- [Troubleshooting](references/TROUBLESHOOTING.md) - Common issues and solutions
