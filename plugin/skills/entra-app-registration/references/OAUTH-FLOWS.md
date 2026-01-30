# OAuth 2.0 Flows

OAuth 2.0 flows supported by Microsoft Entra ID. Use a library for production implementations.

## Authorization Code Flow

**Steps:** User authenticates → Entra returns auth code → App exchanges code for tokens (with client secret) → App calls API

### Authorization URL

```
GET https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?
  client_id={app_id}&response_type=code&redirect_uri={uri}&scope={scopes}&state={state}
```

### Token Exchange

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
client_id={app_id}&code={code}&redirect_uri={uri}&grant_type=authorization_code&client_secret={secret}
```

Returns: `access_token`, `refresh_token`, `id_token`

## Authorization Code Flow with PKCE

PKCE adds security for public clients (SPAs, mobile apps) that can't store secrets.

### PKCE Values

- **Code Verifier:** 43-128 char random string
- **Code Challenge:** `base64URLEncode(sha256(verifier))`

### Authorization URL

Add `&code_challenge={challenge}&code_challenge_method=S256` to standard auth URL.

### Token Exchange (No Secret)

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
client_id={app_id}&code={code}&redirect_uri={uri}&grant_type=authorization_code&code_verifier={verifier}
```

## Client Credentials Flow

For daemon/service apps. Requires **Application** permissions (not delegated) with admin consent.

### Request Token

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
client_id={app_id}&scope=https://graph.microsoft.com/.default&client_secret={secret}&grant_type=client_credentials
```

**Scope format:** `{resource}/.default` (e.g., `https://graph.microsoft.com/.default`)

## Device Code Flow

For devices without browsers (IoT, CLIs, headless environments).

### 1. Request Device Code

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/devicecode
client_id={app_id}&scope={scopes}
```

Returns: `user_code`, `device_code`, `verification_uri` (https://microsoft.com/devicelogin)

### 2. Poll for Token

Display code to user, then poll every `interval` seconds:

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
client_id={app_id}&grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code={device_code}
```

Returns `authorization_pending` error until user completes auth.

## Refresh Token Flow

Refresh expired access tokens without re-authentication. Access tokens expire in ~1 hour; refresh tokens last 14-90 days.

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
client_id={app_id}&refresh_token={token}&grant_type=refresh_token&client_secret={secret}
```

**Note:** `client_secret` only for confidential clients. New refresh token returned; use it for next refresh.

## Token Types

| Token | Purpose | Lifetime | Format |
|-------|---------|----------|--------|
| **Access** | Call APIs | ~1 hour | JWT with claims (aud, iss, scp, exp) |
| **Refresh** | Get new access tokens | 14-90 days | Opaque string, single-use |
| **ID** | User identity info | Session | JWT with user claims (name, email, oid) |

## Scopes

- **MS Graph:** `https://graph.microsoft.com/User.Read`
- **Custom API:** `api://{api_app_id}/access_as_user`

## Security Best Practices

- Use `state` parameter (CSRF protection)
- Use PKCE for public clients
- Validate tokens (signature, issuer, audience, expiration)
- HTTPS only; secure token storage
- Request minimal scopes