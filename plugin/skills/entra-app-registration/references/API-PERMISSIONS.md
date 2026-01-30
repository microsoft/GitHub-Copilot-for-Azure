# API Permissions Guide

## Permission Types

**Delegated (User Context):** App acts on behalf of signed-in user. User must consent.
**Application (App Context):** App acts as itself (daemons, background jobs). Always requires admin consent.

## Scopes

```
https://graph.microsoft.com/User.Read      # Specific scope
https://graph.microsoft.com/.default       # All configured permissions
api://your-api-id/access_as_user           # Custom API
```

## Common Microsoft Graph Permissions

| Permission | Type | Admin Consent |
|------------|------|---------------|
| `User.Read` | Delegated | No |
| `User.Read.All` | Delegated/App | Yes |
| `Mail.Read` / `Mail.Send` | Delegated | No |
| `Directory.Read.All` | Both | Yes |

## Adding Permissions

**Portal:** App registration → API permissions → Add permission → Select API → Choose type → Select permissions

**CLI:** See [CLI-COMMANDS.md](CLI-COMMANDS.md)

## Admin Consent

**When required:** All application permissions, high-privilege delegated permissions

**Grant via Portal:** API permissions → "Grant admin consent for [Org]"
**Grant via CLI:** `az ad app permission admin-consent --id $APP_ID`

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Insufficient privileges" | Missing permission or consent | Add permission, grant admin consent |
| "Consent required" | User/admin hasn't consented | Request consent or admin grant |
| Permission granted but fails | Cached token | Get new token after permission change |

**Debug:** Decode token at https://jwt.ms - check `scp` (delegated) or `roles` (application) claims

## Permission IDs (Microsoft Graph)

**Delegated:**
- User.Read: `e1fe6dd8-ba31-4d61-89e7-88639da4683d`
- Mail.Read: `570282fd-fa5c-430d-a7fd-fc8dc98a9dca`
- Mail.Send: `e383f46e-2787-4529-855e-0e479a3ffac0`

**Application:**
- User.Read.All: `df021288-bdef-4463-88db-98f22de89214`
- Directory.Read.All: `7ab1d382-f21e-4acd-a863-ba3e13f7da61`

## Best Practices

- Start minimal, add incrementally
- Prefer delegated over application permissions
- Review and remove unused permissions
- Document why each permission is needed

[Microsoft Graph Permissions Reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
