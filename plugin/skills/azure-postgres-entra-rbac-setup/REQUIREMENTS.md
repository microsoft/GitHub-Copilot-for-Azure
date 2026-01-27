# Azure Managed PostgreSQL Entra ID RBAC Setup - Requirements

## Overview

This skill helps users set up Microsoft Entra ID (formerly Azure AD) authentication for Azure Database for PostgreSQL Flexible Server for the first time. The authentication model is confusing because it involves a two-layer mapping: **Azure Identity → PostgreSQL Role → Database Permissions**. This skill demystifies the process and provides step-by-step guidance.

## Background Resources

### Agent Skills Documentation
- **Agent Skills Overview**: https://agentskills.io/
- **Skill Specification**: https://agentskills.io/spec
- **Best Practices**: https://agentskills.io/best-practices
- **Examples**: https://agentskills.io/examples

### Azure PostgreSQL Entra Authentication Documentation
- **Main Authentication Guide**: https://learn.microsoft.com/en-us/azure/postgresql/security/security-entra-configure
- **Managing Entra Roles**: https://learn.microsoft.com/en-us/azure/postgresql/security/security-manage-entra-users
- **Entra Authentication Concepts**: https://learn.microsoft.com/en-us/azure/postgresql/security/security-entra-concepts

## Key Pain Points Identified

Based on user experience and documentation analysis, these are the main confusion areas:

1. **Two-Layer Authentication Mapping**
   - Azure identity (User/Group/Service Principal/Managed Identity) maps to PostgreSQL role
   - PostgreSQL role must then be granted database permissions
   - Users often forget the second step

2. **Token-Based Authentication**
   - Access tokens have 5-60 minute validity
   - Tokens must be used as passwords in connection strings
   - Token acquisition command: `az account get-access-token --resource-type oss-rdbms`

3. **Multiple Identity Types with Different Flows**
   - **User**: Requires UPN (userPrincipalName), case-sensitive
   - **Group**: Supports group sync (auto-creates member roles), has two modes
   - **Service Principal**: Requires object ID from Enterprise Applications
   - **Managed Identity**: Requires system or user-assigned identity setup

4. **Cryptic SQL Functions**
   - `pgaadauth_create_principal(roleName, isAdmin, isMfa)` - creates role by name
   - `pgaadauth_create_principal_with_oid(roleName, objectId, objectType, isAdmin, isMfa)` - creates role by object ID
   - `pgaadauth_list_principals(isAdminValue)` - lists all Entra-mapped roles
   - `SECURITY LABEL for "pgaadauth" on role "<roleName>" is 'aadauth,oid=<objectId>,type=<objectType>,admin'` - enables Entra on existing roles
   - `pgaadauth_sync_roles_for_group_members()` - manually syncs group members

5. **Network Requirements**
   - **Private endpoint** configurations need NSG rules for `AzureActiveDirectory` service tag
   - DNS must resolve `login.microsoftonline.com` and `graph.microsoft.com`
   - Firewall rules don't apply to Entra authentication (uses TLS)

6. **Group Sync Confusion**
   - **Sync disabled** (`pgaadauth.enable_group_sync=OFF`): Members sign in with access token, use group name as username
   - **Sync enabled** (`pgaadauth.enable_group_sync=ON`): Members get individual roles, auto-synced every 30 minutes
   - Group role itself should NOT be deleted even with sync enabled

## Target Use Cases

### Use Case 1: First-Time Developer User Setup
**Scenario**: Development team needs Azure identity-based access instead of shared passwords

**Requirements**:
- Check if Entra authentication is enabled on the server
- Add the first Microsoft Entra admin if not configured
- Create non-admin PostgreSQL role for a developer using their UPN
- Grant appropriate database and schema permissions
- Provide connection string template and token retrieval command
- Generate shell scripts for both bash and PowerShell

**Success Criteria**:
- Developer can connect using: `psql "host=SERVER user=USER@DOMAIN dbname=DB sslmode=require"` with token as password
- Developer has SELECT, INSERT, UPDATE, DELETE on application tables
- No credentials stored in code or config files

---

### Use Case 2: Managed Identity for Applications
**Scenario**: Azure Container App / App Service / Function needs passwordless database access

**Requirements**:
- Identify the managed identity (system-assigned or user-assigned)
- Retrieve the managed identity's object ID
- Create PostgreSQL role mapped to the managed identity
- Grant appropriate permissions for the application workload
- Provide application code snippets showing auto-token retrieval (no password needed)
- Support both Node.js, Python, .NET examples

**Success Criteria**:
- Application connects without any stored credentials
- Application uses Azure Identity SDK to auto-acquire tokens
- Connection works from Azure-hosted environment (not local dev)

---

### Use Case 3: Group-Based Access Control
**Scenario**: Manage permissions via Azure AD groups (e.g., "Database Readers", "Database Admins")

**Requirements**:
- Retrieve group display name and object ID from Azure AD
- Create group principal in PostgreSQL
- Configure group sync behavior (ON vs OFF)
- Explain sync semantics: auto-sync interval, manual trigger, member role creation
- Grant permissions to the group role
- Show how group members connect (varies by sync setting)

**Success Criteria**:
- Adding/removing users from Azure AD group automatically affects database access
- Group members understand whether to use group name or individual UPN for connection
- Clear documentation on sync delay (up to 30 minutes)

---

### Use Case 4: Troubleshooting Connection Failures
**Scenario**: Users getting "authentication failed" or "role does not exist" errors

**Requirements**:
- Diagnostic checklist for common issues:
  - Role exists in database (`pgaadauth_list_principals`)
  - Token is fresh (not expired)
  - Username matches exactly (case-sensitive)
  - Network allows `AzureActiveDirectory` service tag (for private endpoint)
  - DNS resolves `login.microsoftonline.com` and `graph.microsoft.com`
- Step-by-step troubleshooting workflow
- Commands to verify each aspect
- Shell scripts for both bash and PowerShell

**Success Criteria**:
- Clear error categorization (auth error vs permission error vs network error)
- Actionable remediation steps for each error type
- Self-service diagnostic commands

---

### Use Case 5: Migration from Password Auth to Entra ID
**Scenario**: Existing PostgreSQL users need to transition from password-based to Entra ID authentication

**Requirements**:
- List existing PostgreSQL roles (exclude system roles)
- Map existing roles to Entra identities using `SECURITY LABEL`
- Support parallel authentication during transition period
- Test Entra auth before disabling passwords
- Switch server to "Microsoft Entra authentication only" mode
- Provide migration plan checklist

**Success Criteria**:
- Zero-downtime migration (parallel auth during transition)
- All existing roles mapped to corresponding Entra identities
- Passwords disabled only after successful Entra auth testing
- Rollback plan documented

---

## Primary Tools and Commands

### Azure CLI Commands
```bash
# Entra Admin Management
az postgres flexible-server microsoft-entra-admin create
az postgres flexible-server microsoft-entra-admin list
az postgres flexible-server microsoft-entra-admin show
az postgres flexible-server microsoft-entra-admin delete

# Token Acquisition
az account get-access-token --resource-type oss-rdbms
az account get-access-token --resource https://ossrdbms-aad.database.windows.net

# Identity Lookups
az ad user show --id <user@domain.com> --query "{displayName:displayName, userPrincipalName:userPrincipalName, objectId:id}"
az ad group show --group "Group Name" --query "{displayName:displayName, objectId:id}"
az identity show --name <identity-name> --resource-group <rg> --query "{name:name, principalId:principalId}"

# Server Parameters
az postgres flexible-server parameter set --name pgaadauth.enable_group_sync --value ON
az postgres flexible-server parameter show --name pgaadauth.enable_group_sync

# Server Management
az postgres flexible-server list --resource-group <rg>
az postgres flexible-server show --name <server> --resource-group <rg>
```

### Azure MCP Tools
- **mcp_azure_mcp_postgres**:
  - `postgres_server_list` - List PostgreSQL servers in subscription
  - `postgres_database_list` - List databases on a server
  - `postgres_database_query` - Execute SQL queries (for role creation, permission grants)
  - `postgres_server_param_get` - Get server parameter value
  - `postgres_server_param_set` - Set server parameter value

- **mcp_azure_mcp_documentation**:
  - `microsoft_docs_search` - Search official Azure docs
  - `microsoft_docs_fetch` - Fetch complete documentation pages
  - `microsoft_code_sample_search` - Find code examples

### PostgreSQL SQL Functions (via psql or MCP)
```sql
-- Create role by name (must match Entra principal name exactly)
SELECT * FROM pgaadauth_create_principal('user@domain.com', false, false);

-- Create role by object ID (more reliable, works for any identity type)
SELECT * FROM pgaadauth_create_principal_with_oid('role-name', 'object-id-guid', 'user|group|service', false, false);

-- List all Entra-mapped roles
SELECT * FROM pgaadauth_list_principals(false); -- false = all users, true = admins only

-- Enable Entra on existing PostgreSQL role
SECURITY LABEL for "pgaadauth" on role "existing_role" is 'aadauth,oid=<object-id>,type=user';

-- Sync group members (if group sync enabled)
SELECT * FROM pgaadauth_sync_roles_for_group_members();

-- Standard PostgreSQL permission grants
GRANT CONNECT ON DATABASE mydb TO "user@domain.com";
GRANT USAGE ON SCHEMA public TO "user@domain.com";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "user@domain.com";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "user@domain.com";

-- List roles
\du

-- Check permissions
\dp
SELECT * FROM information_schema.role_table_grants WHERE grantee = 'user@domain.com';
```

### Connection Commands
```bash
# Bash - psql connection
export PGPASSWORD=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
psql "host=myserver.postgres.database.azure.com user=user@domain.com dbname=mydb sslmode=require"

# Bash - combined token and connection
psql "host=myserver.postgres.database.azure.com user=user@domain.com dbname=mydb sslmode=require password=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)"
```

```powershell
# PowerShell - psql connection
$env:PGPASSWORD = (az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
psql "host=myserver.postgres.database.azure.com user=user@domain.com dbname=mydb sslmode=require"
```

## Skill Features

### 1. Pre-flight Validation
- Check if server has Entra authentication enabled
- Verify network connectivity to Azure AD endpoints
- Validate DNS resolution for `login.microsoftonline.com` and `graph.microsoft.com`
- Check if user has required permissions (at least one Entra admin exists)

### 2. Identity Type Detection
Auto-detect user intent based on input:
- **User mentioned**: "user", "developer", "team member", UPN format
- **Group mentioned**: "group", "team", "role-based"
- **Service Principal mentioned**: "service principal", "app registration", "application"
- **Managed Identity mentioned**: "managed identity", "MI", "system-assigned", "user-assigned", "container app", "app service"

### 3. Token Management Helper
- Auto-generate fresh token acquisition commands
- Display token expiration warning (5-60 minutes)
- Provide both inline and environment variable approaches
- Include shell scripts for both bash and PowerShell

### 4. Permission Templates
Predefined permission sets:
- **Read-Only**: CONNECT, USAGE, SELECT on all tables
- **Read-Write**: CONNECT, USAGE, SELECT, INSERT, UPDATE, DELETE on all tables
- **Admin**: CONNECT, USAGE, ALL PRIVILEGES, plus `azure_pg_admin` role membership
- **Custom**: Prompt user for specific permissions

### 5. Troubleshooting Wizard
Step-by-step diagnostics:
1. Verify role exists in database
2. Check token freshness
3. Validate username spelling (exact match, case-sensitive)
4. Test network connectivity (for private endpoint)
5. Verify DNS resolution
6. Check server authentication mode (Entra only vs both)
7. Review server logs if accessible

### 6. Security Best Practices
- Recommend MFA enforcement (`isMfa=true`) for admin users
- Suggest separate admin and app roles (least privilege)
- Warn about token validity (don't store tokens in code)
- Recommend group-based access for team management
- Advise on token refresh strategies for long-running apps

## Technical Specifications

### Object Types in PostgreSQL
- `user` - Microsoft Entra user (including guests)
- `group` - Microsoft Entra group
- `service` - Service principals and managed identities

### Admin Role Implications
When `isAdmin=true`:
- Role becomes member of `azure_pg_admin`
- Gets `CREATEROLE` and `CREATEDB` privileges
- Can manage other Entra roles via SQL functions

### MFA Flag Behavior
The `isMfa` parameter:
- Tests the `mfa` claim in the Entra token
- Does NOT enforce MFA at tenant level (tenant policy controls that)
- Only useful if tenant has optional MFA configured

### Token Validity
- Minimum: 5 minutes
- Maximum: 60 minutes
- Recommendation: Acquire fresh token immediately before connection
- For long-running apps: Implement token refresh logic using Azure Identity SDK

### Group Sync Modes

**Sync Disabled** (`pgaadauth.enable_group_sync=OFF`):
- Group members sign in using their own access tokens
- Username must be the group name (not individual UPN)
- No individual member roles created

**Sync Enabled** (`pgaadauth.enable_group_sync=ON`):
- Individual member roles auto-created in database
- Synced every 30 minutes automatically
- Manual sync: `SELECT * FROM pgaadauth_sync_roles_for_group_members();`
- Group role should NOT be deleted
- Members can optionally use group name for login (backward compat)

## Edge Cases and Gotchas

1. **Guest Users**: Must use full UPN with `#EXT#` tag (e.g., `guest_user_example.com#EXT#@tenant.onmicrosoft.com`)

2. **Service Principal Object ID**: Must use the Enterprise Application object ID, NOT the App Registration object ID

3. **Spaces in Names**: Must escape spaces in psql: `"Group\ Name"` or wrap in double quotes

4. **Case Sensitivity**: All Entra principal names are case-sensitive in PostgreSQL

5. **Token Resource URL**: Different for sovereign clouds:
   - Azure Public: `https://ossrdbms-aad.database.windows.net`
   - Use `az cloud show` to find correct resource for other clouds

6. **Private Endpoint Network**: Must configure NSG and route table for `AzureActiveDirectory` service tag

7. **Default Privileges**: Use `ALTER DEFAULT PRIVILEGES` for permissions on future tables:
   ```sql
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "user@domain.com";
   ```

8. **Connection String Format**: PostgreSQL connection string requires:
   - `sslmode=require` (TLS mandatory)
   - Username in UPN format or group name
   - Password is the access token (not a real password)

## Shell Script Requirement

**CRITICAL**: All shell scripts MUST include both **bash** and **PowerShell** versions to ensure compatibility with Linux, Mac, and Windows environments.

Example format:
```markdown
### Bash Script
\`\`\`bash
# Commands here
\`\`\`

### PowerShell Script
\`\`\`powershell
# Commands here
\`\`\`
```

## Success Metrics

The skill is successful if:
1. User can enable Entra authentication on a new or existing PostgreSQL server
2. User can create PostgreSQL roles for Users, Groups, Service Principals, and Managed Identities
3. User understands the token-based authentication model
4. User can grant appropriate database permissions
5. User can troubleshoot common authentication failures
6. User can migrate from password-based to Entra ID authentication
7. All examples work on Linux, Mac, and Windows (via bash and PowerShell scripts)

## References and Links

- **Azure PostgreSQL Flexible Server Overview**: https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/overview
- **Azure Identity SDK for .NET**: https://learn.microsoft.com/en-us/dotnet/api/overview/azure/identity-readme
- **Azure Identity SDK for Python**: https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme
- **Azure Identity SDK for JavaScript**: https://learn.microsoft.com/en-us/javascript/api/overview/azure/identity-readme
- **PostgreSQL psql Documentation**: https://www.postgresql.org/docs/current/app-psql.html
- **Azure RBAC Built-in Roles**: https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
- **Microsoft Entra ID Overview**: https://learn.microsoft.com/en-us/entra/fundamentals/whatis

## Next Steps

This REQUIREMENTS.md document should be handed off to the Plan agent to create a detailed implementation plan including:
- Skill structure (SKILL.md format)
- Script files (bash and PowerShell)
- Example files (connection strings, permission templates)
- Reference documentation
- Test scenarios
