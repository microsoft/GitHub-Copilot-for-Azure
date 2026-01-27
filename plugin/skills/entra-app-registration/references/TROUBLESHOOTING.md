# Troubleshooting Microsoft Entra App Registration

This guide helps you diagnose and fix common issues with app registrations and authentication.

## Table of Contents

- [Authentication Errors](#authentication-errors)
- [Token Issues](#token-issues)
- [Permission Problems](#permission-problems)
- [Redirect URI Issues](#redirect-uri-issues)
- [Application Configuration](#application-configuration)
- [Debugging Tools](#debugging-tools)

---

## Authentication Errors

### AADSTS50011: Redirect URI Mismatch

**Error message:**
```
AADSTS50011: The redirect URI 'http://localhost:3000' specified in the request 
does not match the redirect URIs configured for the application.
```

**Cause:** The redirect URI in your authentication request doesn't exactly match what's registered.

**Solutions:**

1. **Check exact match** (case-sensitive, trailing slash matters):
   ```
   Registered: https://myapp.com/callback
   Request:    https://myapp.com/callback/  ❌ (trailing slash)
   Request:    https://MyApp.com/callback   ❌ (case difference)
   Request:    https://myapp.com/callback   ✅
   ```

2. **Add URI to app registration:**
   ```bash
   # Portal: Authentication → Add redirect URI
   # CLI:
   az ad app update --id $APP_ID \
     --web-redirect-uris "http://localhost:3000" "https://myapp.com/callback"
   ```

3. **Check platform type:**
   - Web URIs go in "Web" platform
   - SPA URIs go in "Single-page application"
   - Desktop/mobile URIs go in "Public client/native"

---

### AADSTS7000215: Invalid Client Secret

**Error message:**
```
AADSTS7000215: Invalid client secret provided. 
Ensure the secret being sent in the request is the client secret value, not the client secret ID.
```

**Causes:**
- Client secret expired
- Wrong secret value (copied secret ID instead of value)
- Secret doesn't match app registration

**Solutions:**

1. **Create new secret:**
   ```bash
   az ad app credential reset --id $APP_ID --years 1
   ```
   Copy the `password` value (not the `keyId`)

2. **Verify secret in your code:**
   ```javascript
   // ❌ Wrong - this is the secret ID
   clientSecret: "12345678-1234-1234-1234-123456789012"
   
   // ✅ Correct - this is the secret value
   clientSecret: "abc123~xyz789DEFghi456JKL"
   ```

3. **Check expiration:**
   ```bash
   az ad app credential list --id $APP_ID
   ```

---

### AADSTS65001: User Consent Required

**Error message:**
```
AADSTS65001: The user or administrator has not consented to use the application
```

**Causes:**
- Application permissions require admin consent
- User hasn't consented to delegated permissions
- Consent was revoked

**Solutions:**

1. **Grant admin consent (if admin):**
   ```bash
   az ad app permission admin-consent --id $APP_ID
   ```

2. **Request user consent (interactive flow):**
   ```javascript
   // Add prompt parameter
   const authResult = await pca.acquireTokenInteractive({
     scopes: ["User.Read"],
     prompt: "consent"  // Force consent screen
   });
   ```

3. **Check API permissions in portal:**
   - Ensure permissions are added
   - Look for green checkmarks (granted)
   - Yellow warning means not granted

---

### AADSTS70000: Grant Declined

**Error message:**
```
AADSTS70000: The request was denied because one or more permissions have been declined
```

**Cause:** User or admin explicitly denied consent.

**Solutions:**

1. **Re-request with explanation:**
   - Explain why permissions are needed
   - Request only necessary permissions

2. **Check if admin consent is required:**
   - Some organizations disable user consent
   - Contact your admin to grant consent

3. **Reduce permission scope:**
   - Request minimal permissions initially
   - Use incremental consent for additional features

---

### AADSTS700016: Application Not Found

**Error message:**
```
AADSTS700016: Application with identifier '{app-id}' was not found in the directory
```

**Causes:**
- Wrong application ID
- Wrong tenant ID
- Service principal not created
- App in different tenant

**Solutions:**

1. **Verify application ID:**
   ```bash
   az ad app list --display-name "MyApp" --query "[].{Name:displayName, AppId:appId}"
   ```

2. **Verify tenant ID:**
   ```bash
   az account show --query tenantId -o tsv
   ```

3. **Create service principal:**
   ```bash
   az ad sp create --id $APP_ID
   ```

4. **Check you're in correct tenant:**
   ```bash
   az account list --output table
   az account set --subscription "correct-subscription"
   ```

---

### AADSTS90014: Missing Required Field

**Error message:**
```
AADSTS90014: The required field 'client_id' is missing from the request
```

**Cause:** Authentication request is missing required parameters.

**Required parameters vary by flow:**

**Authorization Code:**
- `client_id` ✅
- `response_type` ✅
- `redirect_uri` ✅
- `scope` ✅

**Client Credentials:**
- `client_id` ✅
- `client_secret` ✅
- `grant_type` ✅
- `scope` ✅

**Solution:** Verify all required parameters are included in request.

---

## Token Issues

### Token Expired

**Error:** `401 Unauthorized` or `The token is expired`

**Cause:** Access tokens typically expire in 1 hour.

**Solutions:**

1. **Implement token refresh:**
   ```javascript
   // Check if token is about to expire
   if (Date.now() >= tokenExpiry) {
     // Refresh token
     const result = await pca.acquireTokenSilent({
       account: account,
       scopes: ["User.Read"]
     });
   }
   ```

2. **Use refresh token:**
   ```http
   POST /oauth2/v2.0/token
   grant_type=refresh_token
   refresh_token={refresh_token}
   client_id={client_id}
   scope={scopes}
   ```

3. **Handle expiration gracefully:**
   ```javascript
   try {
     // Call API
   } catch (error) {
     if (error.status === 401) {
       // Token expired - refresh and retry
       await refreshToken();
       // Retry API call
     }
   }
   ```

---

### Invalid Audience

**Error:** `The audience is invalid` or `Invalid token`

**Cause:** Token was issued for different resource/API.

**Solutions:**

1. **Verify scope matches target API:**
   ```javascript
   // ❌ Wrong - Graph token for your API
   scopes: ["https://graph.microsoft.com/User.Read"]
   apiUrl: "https://my-api.com/data"
   
   // ✅ Correct - Token for your API
   scopes: ["api://my-api-id/access_as_user"]
   apiUrl: "https://my-api.com/data"
   ```

2. **Decode token to check audience:**
   - Go to https://jwt.ms
   - Paste your token
   - Check `aud` claim matches your API

3. **Get correct token for each resource:**
   ```javascript
   // Token for Microsoft Graph
   const graphToken = await getToken(["https://graph.microsoft.com/.default"]);
   
   // Token for your API
   const apiToken = await getToken(["api://your-api/.default"]);
   ```

---

### Token Missing Claims

**Error:** API returns permission denied even with valid token.

**Cause:** Token doesn't contain required claims/scopes.

**Solutions:**

1. **Decode token and check claims:**
   ```bash
   # View token at https://jwt.ms
   # Check these claims:
   # - scp (delegated permissions)
   # - roles (application permissions)
   # - oid (user object ID)
   ```

2. **Verify permissions are granted:**
   ```bash
   az ad app permission list --id $APP_ID
   ```

3. **Get new token after permission changes:**
   - Permissions added after token was issued
   - Clear token cache and re-authenticate

---

## Permission Problems

### "Insufficient Privileges" Error

**Error when calling API:**
```json
{
  "error": {
    "code": "Forbidden",
    "message": "Insufficient privileges to complete the operation."
  }
}
```

**Causes:**
- Permission not added to app
- Admin consent not granted
- User lacks permission
- Using delegated permission but user has no rights

**Solutions:**

1. **Check app has permission:**
   - Portal → API permissions
   - Verify required permission is listed

2. **Grant admin consent:**
   ```bash
   az ad app permission admin-consent --id $APP_ID
   ```

3. **Verify user has rights:**
   - Delegated permissions inherit user's limitations
   - User must have access to resource being accessed

4. **Consider application permission:**
   - If app needs to work regardless of user rights
   - Requires admin consent

---

### Permission Works in Portal but Not in App

**Symptom:** Can access resource in Azure Portal but app gets permission error.

**Causes:**
- Portal uses your full admin permissions
- App may have limited permissions
- Token might be cached without new permissions

**Solutions:**

1. **Clear token cache:**
   ```javascript
   // MSAL
   const accounts = await pca.getAllAccounts();
   await pca.removeAccount(accounts[0]);
   ```

2. **Verify app's actual permissions:**
   - Decode token: https://jwt.ms
   - Check `scp` or `roles` claim

3. **Grant missing permissions:**
   - Compare what portal has vs what app has
   - Add missing permissions to app

---

## Redirect URI Issues

### Localhost Not Working

**Problem:** `http://localhost:3000` not working for redirect.

**Solutions:**

1. **Add exact localhost URI:**
   ```bash
   az ad app update --id $APP_ID \
     --public-client-redirect-uris "http://localhost:3000"
   ```

2. **Try `http://127.0.0.1:3000` if localhost fails**

3. **Ensure correct platform:**
   - SPAs: Use "Single-page application" platform
   - Desktop/Console: Use "Public client/native" platform

4. **For production, always use HTTPS:**
   - `http://` only allowed for localhost
   - Production must use `https://`

---

### HTTPS Required Error

**Error:** Redirect URI must use HTTPS.

**Causes:**
- Using `http://` for non-localhost URI
- SSL certificate issues

**Solutions:**

1. **Use HTTPS for all non-localhost URIs:**
   ```
   ❌ http://myapp.com/callback
   ✅ https://myapp.com/callback
   ✅ http://localhost:3000  (exception)
   ```

2. **For development:**
   - Use `localhost` with `http://`
   - Or set up local SSL certificate

---

## Application Configuration

### Public Client Flows Disabled

**Error:** Unable to use device code or ROPC flow.

**Solution:** Enable public client flows:

1. **Portal method:**
   - Go to Authentication
   - Advanced settings → Allow public client flows
   - Set to "Yes"

2. **CLI method:**
   ```bash
   az ad app update --id $APP_ID \
     --set publicClient=true
   ```

---

### Multi-Tenant Not Working

**Error:** Users from other tenants can't sign in.

**Solutions:**

1. **Change account type:**
   ```bash
   # Portal: Authentication → Supported account types
   # Select "Accounts in any organizational directory"
   ```

2. **Use `common` or `organizations` in authority:**
   ```javascript
   // ❌ Single tenant
   authority: "https://login.microsoftonline.com/{tenant-id}"
   
   // ✅ Multi-tenant
   authority: "https://login.microsoftonline.com/common"
   // or
   authority: "https://login.microsoftonline.com/organizations"
   ```

3. **Ensure service principal created in target tenant:**
   - First user from tenant needs admin consent
   - Creates service principal in their tenant

---

## Debugging Tools

### JWT Token Decoder

**Tool:** https://jwt.ms

**How to use:**
1. Copy your access token
2. Paste into jwt.ms
3. Review claims:
   - `aud` - Audience (should match your API)
   - `iss` - Issuer (should be login.microsoftonline.com)
   - `scp` - Delegated permissions
   - `roles` - Application permissions
   - `exp` - Expiration timestamp
   - `oid` - User object ID

---

### Fiddler/Postman

**Use for:** Inspecting HTTP requests/responses

**What to check:**
- Authorization header format: `Bearer {token}`
- Token is being sent
- Response status codes and error messages

---

### Azure AD Sign-in Logs

**Access:** Azure Portal → Microsoft Entra ID → Sign-in logs

**What to check:**
- Failed sign-in attempts
- Error codes and messages
- User consent status
- Conditional Access policy failures

---

### Enable MSAL Logging

**JavaScript:**
```javascript
const config = {
  auth: { /* ... */ },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        console.log(message);
      },
      logLevel: msal.LogLevel.Verbose,
      piiLoggingEnabled: false
    }
  }
};
```

**Python:**
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

**.NET:**
```csharp
.WithLogging((level, message, pii) => 
{
    Console.WriteLine($"{level}: {message}");
})
```

---

## Common Error Codes Reference

| Error Code | Meaning | Common Cause |
|------------|---------|--------------|
| AADSTS50011 | Redirect URI mismatch | URI not registered or doesn't match |
| AADSTS50020 | Invalid tenant | Wrong tenant in authority URL |
| AADSTS50034 | User not found | User doesn't exist in tenant |
| AADSTS50053 | Account locked | Too many failed attempts |
| AADSTS50055 | Password expired | User needs to reset password |
| AADSTS50057 | Account disabled | User account disabled |
| AADSTS50058 | Silent sign-in failed | Interactive auth required |
| AADSTS50059 | Tenant not found | Invalid tenant ID |
| AADSTS65001 | Consent required | User/admin hasn't consented |
| AADSTS70000 | Grant declined | User denied consent |
| AADSTS70001 | App disabled | App registration disabled |
| AADSTS700016 | App not found | Invalid app ID or wrong tenant |
| AADSTS7000215 | Invalid client secret | Wrong/expired secret |
| AADSTS90014 | Missing field | Required parameter not sent |
| AADSTS90072 | Consent needed | Admin consent required |

---

## Best Practices for Troubleshooting

### Systematic Approach

1. **Collect information:**
   - Exact error message and code
   - When it started happening
   - What changed recently
   - Environment (dev/test/prod)

2. **Check basics first:**
   - App ID and tenant ID correct
   - Permissions added and consented
   - Redirect URIs configured
   - Secrets/certificates valid

3. **Use debugging tools:**
   - Decode tokens (jwt.ms)
   - Check sign-in logs
   - Enable MSAL logging
   - Use network inspector

4. **Test incrementally:**
   - Test with minimal permissions
   - Add permissions one at a time
   - Test different flows separately

5. **Document solution:**
   - Note what fixed the issue
   - Update documentation
   - Share with team

---

## Getting Help

### Microsoft Resources

- [Microsoft Q&A](https://learn.microsoft.com/answers/)
- [Stack Overflow - azure-ad-msal](https://stackoverflow.com/questions/tagged/azure-ad-msal)
- [Microsoft Identity Platform Documentation](https://learn.microsoft.com/entra/identity-platform/)

### Information to Include

When asking for help, provide:
- Error code and full message
- Application ID (safe to share)
- Tenant ID (safe to share)
- Flow being used
- Code snippet (remove secrets!)
- What you've tried already

**Never share:**
- Client secrets
- Access tokens
- Refresh tokens
- Passwords

---

## Next Steps

If issues persist:
- Review [OAUTH-FLOWS.md](OAUTH-FLOWS.md) for flow details
- Check [API-PERMISSIONS.md](API-PERMISSIONS.md) for permission setup
- Consult [CONSOLE-APP-EXAMPLE.md](CONSOLE-APP-EXAMPLE.md) for working code
