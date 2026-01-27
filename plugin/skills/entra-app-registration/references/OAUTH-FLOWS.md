# OAuth 2.0 Flows

This document provides detailed explanations of OAuth 2.0 authentication flows supported by Microsoft Entra ID.

## Authorization Code Flow

**Use for:** Traditional web applications with server-side code

### Flow Diagram

```
1. User → App: Navigate to app
2. App → User: Redirect to Microsoft login
3. User → Entra ID: Authenticate & consent
4. Entra ID → App: Authorization code (via redirect URI)
5. App → Entra ID: Exchange code for tokens (with client secret)
6. Entra ID → App: Access token + refresh token + ID token
7. App → API: Call API with access token
```

### Implementation Steps

#### 1. Build Authorization URL

```
https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?
  client_id={application_id}
  &response_type=code
  &redirect_uri={redirect_uri}
  &response_mode=query
  &scope={scopes}
  &state={random_state}
```

**Parameters:**
- `tenant`: Your tenant ID or `common` for multi-tenant
- `client_id`: Application (client) ID from app registration
- `redirect_uri`: Must match exactly what's registered
- `scope`: Space-separated permissions (e.g., `openid profile User.Read`)
- `state`: Random value to prevent CSRF attacks

#### 2. User Authenticates

User is redirected to Microsoft login page, authenticates, and grants consent.

#### 3. Receive Authorization Code

App receives callback at redirect URI:
```
https://your-app.com/callback?
  code={authorization_code}
  &state={state_value}
```

**Validation:**
- Verify `state` matches what you sent
- Extract `code` parameter

#### 4. Exchange Code for Tokens

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={application_id}
&scope={scopes}
&code={authorization_code}
&redirect_uri={redirect_uri}
&grant_type=authorization_code
&client_secret={client_secret}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "M.R3_BAY...",
  "id_token": "eyJ0eXAi..."
}
```

#### 5. Use Access Token

```http
GET https://graph.microsoft.com/v1.0/me
Authorization: Bearer {access_token}
```

---

## Authorization Code Flow with PKCE

**Use for:** Single-page apps (SPAs), mobile apps, desktop apps

PKCE (Proof Key for Code Exchange) adds security for public clients that cannot securely store a client secret.

### Flow Diagram

```
1. App: Generate code verifier (random string)
2. App: Generate code challenge (SHA256 hash of verifier)
3. App → Entra ID: Authorization request with code challenge
4. User → Entra ID: Authenticate & consent
5. Entra ID → App: Authorization code
6. App → Entra ID: Exchange code + code verifier for token
7. Entra ID: Validates verifier matches challenge
8. Entra ID → App: Access token + ID token
```

### Implementation Steps

#### 1. Generate PKCE Values

**Code Verifier:** 43-128 character random string
```javascript
// JavaScript example
const codeVerifier = generateRandomString(128);
```

**Code Challenge:** Base64URL-encoded SHA256 hash of verifier
```javascript
const codeChallenge = base64URLEncode(sha256(codeVerifier));
```

#### 2. Build Authorization URL

```
https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?
  client_id={application_id}
  &response_type=code
  &redirect_uri={redirect_uri}
  &scope={scopes}
  &state={state}
  &code_challenge={code_challenge}
  &code_challenge_method=S256
```

#### 3. Exchange Code for Tokens (No Secret)

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={application_id}
&scope={scopes}
&code={authorization_code}
&redirect_uri={redirect_uri}
&grant_type=authorization_code
&code_verifier={code_verifier}
```

**Note:** No `client_secret` required!

---

## Client Credentials Flow

**Use for:** Daemon apps, background services, API-to-API calls without user context

### Flow Diagram

```
1. App → Entra ID: Request token with client ID + secret
2. Entra ID: Validate credentials
3. Entra ID → App: Access token (application permissions)
4. App → API: Call API with token
```

### Implementation Steps

#### 1. Configure Application Permissions

In app registration:
1. Go to "API permissions"
2. Add **Application** permissions (not delegated)
3. Grant admin consent (required for app permissions)

**Example permissions:**
- `User.Read.All` (application) - Read all users
- `Directory.Read.All` (application) - Read directory

#### 2. Request Access Token

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={application_id}
&scope=https://graph.microsoft.com/.default
&client_secret={client_secret}
&grant_type=client_credentials
```

**Parameters:**
- `scope`: Use `{resource}/.default` format
  - For Microsoft Graph: `https://graph.microsoft.com/.default`
  - For your API: `api://{api_app_id}/.default`

**Response:**
```json
{
  "access_token": "eyJ0eXAi...",
  "token_type": "Bearer",
  "expires_in": 3599
}
```

**Note:** No refresh token (app can always request new token)

#### 3. Use Access Token

```http
GET https://graph.microsoft.com/v1.0/users
Authorization: Bearer {access_token}
```

---

## Device Code Flow

**Use for:** Devices without browsers (IoT, CLIs), headless environments

### Flow Diagram

```
1. App → Entra ID: Request device code
2. Entra ID → App: Device code + user code + verification URL
3. App → User: Display code and URL
4. User: Opens URL on another device, enters code
5. User → Entra ID: Authenticates & consents
6. App → Entra ID: Poll for token
7. Entra ID → App: Access token (after user completes auth)
```

### Implementation Steps

#### 1. Request Device Code

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/devicecode
Content-Type: application/x-www-form-urlencoded

client_id={application_id}
&scope={scopes}
```

**Response:**
```json
{
  "user_code": "GTHK-QPMN",
  "device_code": "GMMhmHCXhWEzkobqIHGG_EnNYYsAkukHspeYUk9E8",
  "verification_uri": "https://microsoft.com/devicelogin",
  "expires_in": 900,
  "interval": 5,
  "message": "To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code GTHK-QPMN to authenticate."
}
```

#### 2. Display Instructions to User

```
To sign in, open https://microsoft.com/devicelogin
and enter code: GTHK-QPMN
```

#### 3. Poll for Token

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={application_id}
&grant_type=urn:ietf:params:oauth:grant-type:device_code
&device_code={device_code}
```

**Poll every 5 seconds (use `interval` from response)**

**Pending Response (user hasn't completed auth yet):**
```json
{
  "error": "authorization_pending",
  "error_description": "AADSTS70016: Pending end-user authorization..."
}
```

**Success Response:**
```json
{
  "access_token": "eyJ0eXAi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "M.R3_BAY...",
  "id_token": "eyJ0eXAi..."
}
```

---

## Refresh Token Flow

**Use for:** Refreshing expired access tokens without re-authentication

### When to Refresh

- Access tokens typically expire in 1 hour
- Refresh tokens are long-lived (14-90 days)
- Refresh before access token expires for seamless UX

### Implementation

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={application_id}
&scope={scopes}
&refresh_token={refresh_token}
&grant_type=refresh_token
&client_secret={client_secret}
```

**Note:** `client_secret` only required for confidential clients

**Response:**
```json
{
  "access_token": "eyJ0eXAi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "M.R3_BAY...",
  "id_token": "eyJ0eXAi..."
}
```

**Important:** New refresh token is returned; use it for next refresh

---

## Token Types

### Access Token

- Used to call APIs
- Contains claims (user ID, permissions, etc.)
- Short-lived (typically 1 hour)
- Format: JWT (JSON Web Token)

**Sample claims:**
```json
{
  "aud": "https://graph.microsoft.com",
  "iss": "https://sts.windows.net/{tenant}/",
  "sub": "{user_object_id}",
  "scp": "User.Read Mail.Read",
  "exp": 1680000000
}
```

### Refresh Token

- Used to get new access tokens
- Long-lived (days to months)
- Opaque string (not JWT)
- Single-use (new one issued with each refresh)

### ID Token

- Contains user identity information
- Used by the app to authenticate user
- Format: JWT

**Sample claims:**
```json
{
  "sub": "{user_object_id}",
  "name": "Jane Doe",
  "preferred_username": "jane@contoso.com",
  "email": "jane@contoso.com",
  "oid": "{object_id}"
}
```

---

## Scopes and Permissions

### Scope Format

**Microsoft Graph:**
```
https://graph.microsoft.com/User.Read
https://graph.microsoft.com/Mail.Send
```

**Custom API:**
```
api://{api_application_id}/access_as_user
```

### Common Scopes

| Scope | Permission | Type |
|-------|-----------|------|
| `openid` | OpenID Connect sign-in | Delegated |
| `profile` | Basic profile info | Delegated |
| `email` | Email address | Delegated |
| `offline_access` | Refresh token | Delegated |
| `User.Read` | Read user profile | Delegated |
| `User.ReadWrite` | Read/write user profile | Delegated |
| `Mail.Read` | Read mail | Delegated |
| `Mail.Send` | Send mail | Delegated |

### Incremental Consent

Request minimal scopes initially, request additional scopes later as needed.

```javascript
// Initial login - minimal scopes
scopes = "openid profile User.Read"

// Later, when sending email
scopes = "Mail.Send"
```

---

## Security Considerations

| Practice | Why |
|----------|-----|
| **Use state parameter** | Prevents CSRF attacks |
| **Use PKCE for public clients** | Prevents authorization code interception |
| **Validate tokens** | Verify signature, issuer, audience, expiration |
| **Use HTTPS only** | Protect tokens in transit |
| **Store tokens securely** | Use secure storage, never in localStorage for sensitive apps |
| **Implement token refresh** | Seamless UX without repeated logins |
| **Handle token expiration** | Gracefully refresh or re-authenticate |
| **Minimal scope principle** | Request only necessary permissions |

---

## Common Errors

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `AADSTS50011` | Redirect URI mismatch | Ensure exact match in app registration |
| `AADSTS65001` | User consent required | Add permissions or grant admin consent |
| `AADSTS70000` | Grant declined | User denied consent; request again or adjust permissions |
| `AADSTS700016` | App not found | Check application ID and tenant |
| `AADSTS90014` | Missing required field | Check all required parameters |
| `invalid_grant` | Token expired or invalid | Use refresh token or re-authenticate |
