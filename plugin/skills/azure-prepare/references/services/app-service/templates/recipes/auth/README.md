# Entra ID / Easy Auth Recipe — REFERENCE ONLY

Adds authentication and authorization to an App Service base template using Microsoft Entra ID.

## Overview

This recipe configures authentication for App Service apps using either Easy Auth (built-in authentication) or MSAL SDK-based authentication. Easy Auth requires zero code changes; MSAL gives full control.

## Integration Type

| Aspect | Value |
|--------|-------|
| **Provider** | Microsoft Entra ID (Azure AD) |
| **Method** | Easy Auth (built-in) or MSAL SDK |
| **Protocols** | OpenID Connect, OAuth 2.0 |
| **Token validation** | Automatic (Easy Auth) or middleware (MSAL) |

## Option A: Easy Auth (Recommended for most apps)

Zero-code authentication built into App Service. Handles login, token management, and session cookies.

### Bicep Configuration

```bicep
resource authSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webApp
  name: 'authsettingsV2'
  properties: {
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'RedirectToLoginPage'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          openIdIssuer: 'https://sts.windows.net/${tenant().tenantId}/v2.0'
          clientId: appRegistration.outputs.clientId
        }
        validation: {
          defaultAuthorizationPolicy: {
            allowedApplications: []
          }
        }
      }
    }
    login: {
      tokenStore: {
        enabled: true
      }
    }
  }
}
```

### App Registration

```bicep
resource appRegistration 'Microsoft.Graph/applications@v1.0' = {
  displayName: '${name}-app'
  web: {
    redirectUris: [
      'https://${webApp.properties.defaultHostName}/.auth/login/aad/callback'
    ]
  }
}
```

## Option B: MSAL SDK (Full control)

Use when you need custom token validation, API-only auth, or multi-tenant support.

### C# (ASP.NET Core)

```csharp
// Program.cs — add authentication
using Microsoft.Identity.Web;

builder.Services.AddMicrosoftIdentityWebApiAuthentication(builder.Configuration);
builder.Services.AddAuthorization();

// After app build
app.UseAuthentication();
app.UseAuthorization();

// Protected endpoint
app.MapGet("/api/me", [Authorize] (HttpContext ctx) =>
{
    var name = ctx.User.FindFirst("name")?.Value;
    return Results.Ok(new { name });
});
```

**appsettings.json:**
```json
{
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "<tenant-id>",
    "ClientId": "<client-id>",
    "Audience": "api://<client-id>"
  }
}
```

### Python (FastAPI)

```python
import os
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient

security = HTTPBearer()
TENANT_ID = os.environ["AZURE_TENANT_ID"]
CLIENT_ID = os.environ["AZURE_CLIENT_ID"]
JWKS_URL = f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"

jwks_client = PyJWKClient(JWKS_URL)

async def validate_token(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(creds.credentials)
        payload = jwt.decode(
            creds.credentials,
            signing_key.key,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            issuer=f"https://login.microsoftonline.com/{TENANT_ID}/v2.0",
        )
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### Node.js (Express)

```javascript
const { ConfidentialClientApplication } = require("@azure/msal-node");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys`,
});

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  const decoded = jwt.decode(token, { complete: true });
  client.getSigningKey(decoded.header.kid, (err, key) => {
    jwt.verify(token, key.getPublicKey(), {
      audience: process.env.AZURE_CLIENT_ID,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
    }, (err, payload) => {
      if (err) return res.status(401).json({ error: "Invalid token" });
      req.user = payload;
      next();
    });
  });
}
```

## App Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `AZURE_TENANT_ID` | Entra tenant ID | Identity provider |
| `AZURE_CLIENT_ID` | App registration client ID | Application identity |

## References

- [Easy Auth overview](https://learn.microsoft.com/en-us/azure/app-service/overview-authentication-authorization)
- [Microsoft Identity Web](https://learn.microsoft.com/en-us/entra/msal/dotnet/microsoft-identity-web/)
- [Configure Entra ID auth](https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-provider-aad)
