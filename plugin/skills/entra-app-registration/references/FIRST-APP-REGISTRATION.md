# First App Registration - Step-by-Step Guide

This guide walks you through creating your first Microsoft Entra app registration from scratch.

## Overview

You'll learn how to:
1. Create an app registration in Azure Portal
2. Configure authentication settings
3. Add API permissions
4. Create client credentials
5. Test the authentication flow

**Estimated time:** 15 minutes

---

## Prerequisites

- Azure subscription (free tier works)
- Azure Portal access: https://portal.azure.com
- Basic understanding of your application type (web, mobile, service)

---

## Step 1: Navigate to App Registrations

1. Open [Azure Portal](https://portal.azure.com)
2. Search for **"Microsoft Entra ID"** (or "Azure Active Directory")
3. In the left menu, click **"App registrations"**
4. Click **"+ New registration"** at the top

**Screenshot guidance:**
- Look for the blue "+ New registration" button
- It's in the top-left area of the App registrations page

---

## Step 2: Register Your Application

You'll see a form with several fields:

### Application Name
- **What to enter:** A descriptive name for your app
- **Example:** "My First Console App" or "Product Inventory API"
- **Tip:** Use a name that clearly identifies the purpose

### Supported Account Types

Choose who can use your application:

| Option | When to Use | Example |
|--------|-------------|---------|
| **Accounts in this organizational directory only (Single tenant)** | Internal apps, company-only access | Employee portal |
| **Accounts in any organizational directory (Multi-tenant)** | SaaS apps for other organizations | Project management tool |
| **Accounts in any organizational directory + Personal Microsoft accounts** | Consumer apps | Fitness tracker app |
| **Personal Microsoft accounts only** | Consumer-only apps | Personal todo list |

**For your first app:** Select **"Accounts in this organizational directory only"** (single tenant)

### Redirect URI (optional)

The redirect URI is where authentication responses are sent.

**Platform:** Select the type:
- **Web** - Server-side web apps
- **Single-page application (SPA)** - React, Angular, Vue apps
- **Public client/native** - Mobile, desktop, console apps

**URI examples:**
- Web app: `https://localhost:5001/signin-oidc`
- SPA: `http://localhost:3000`
- Console/Desktop: `http://localhost`

**For your first app:** Select **"Public client/native"** and enter `http://localhost`

### Click "Register"

After clicking, you'll be redirected to your app's overview page.

---

## Step 3: Save Important Information

On the **Overview** page, you'll see critical information. **Copy and save these values:**

### Application (client) ID
- **What it is:** Unique identifier for your app
- **Format:** `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (GUID)
- **When you need it:** Every time your app authenticates
- **Where to save:** Environment variables, configuration file (not in code!)

### Directory (tenant) ID
- **What it is:** Unique identifier for your Azure AD tenant
- **Format:** `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (GUID)
- **When you need it:** Constructing authentication URLs

### Example values to save:
```bash
# Save these in a secure location
APPLICATION_CLIENT_ID="12345678-1234-1234-1234-123456789012"
TENANT_ID="87654321-4321-4321-4321-210987654321"
```

---

## Step 4: Configure Authentication (Optional)

Click **"Authentication"** in the left menu.

### Advanced Settings

**Allow public client flows:**
- **What it is:** Enables device code flow, resource owner password flow
- **For console apps:** Turn this **ON**
- **For web apps:** Keep **OFF**

Toggle the switch to **"Yes"** under **"Allow public client flows"**

### Supported account types

You can change this later if needed.

### Logout URL (optional)

Where to redirect users after logout.

**Click "Save"** at the top if you made changes.

---

## Step 5: Add API Permissions

Click **"API permissions"** in the left menu.

### Default Permission

You'll see one default permission:
- **Microsoft Graph → User.Read (Delegated)**

This allows your app to read the signed-in user's profile.

### Add More Permissions

1. Click **"+ Add a permission"**
2. Select **"Microsoft Graph"**
3. Choose **"Delegated permissions"** (for user context)
4. Search for and select permissions you need:
   - **User.Read** - Read user profile (already added)
   - **Mail.Read** - Read user's mail
   - **Calendars.Read** - Read user's calendar

5. Click **"Add permissions"**

### Admin Consent

Some permissions require admin consent:
- If you're an admin: Click **"Grant admin consent for [Your Org]"**
- If you're not: Ask your admin to grant consent

**Status indicator:**
- ✅ Green checkmark = Granted
- ⚠️ Yellow warning = Not granted (may still work for user consent)

---

## Step 6: Create Client Secret (If Needed)

**Skip this if:** You're building a desktop/mobile/console app (public client)

**Do this if:** You're building a web app, API, or service (confidential client)

1. Click **"Certificates & secrets"** in the left menu
2. Click **"+ New client secret"**
3. Enter a description: "Development Secret"
4. Choose expiration:
   - **Recommended for development:** 6 months
   - **For production:** 12-24 months (set up rotation)
5. Click **"Add"**

**⚠️ CRITICAL:** Copy the secret **Value** immediately!
- It's only shown once
- You cannot retrieve it later
- If you lose it, create a new one

```bash
# Save this securely (example)
CLIENT_SECRET="abc123~defGHI456jklMNO789pqrSTU"
```

**Security tips:**
- Never commit secrets to source control
- Use Azure Key Vault for production
- Use environment variables for development

---

## Step 7: Test Your App Registration

### Option A: Quick Test with Azure CLI

```bash
# Set your values
CLIENT_ID="your-client-id-here"
TENANT_ID="your-tenant-id-here"

# Interactive login
az login --scope "https://graph.microsoft.com/.default"

# Get an access token
az account get-access-token --resource "https://graph.microsoft.com"
```

### Option B: Test with MSAL Library

See the complete code example in [CONSOLE-APP-EXAMPLE.md](CONSOLE-APP-EXAMPLE.md)

**Minimal Python example:**
```python
import msal

CLIENT_ID = "your-client-id-here"
TENANT_ID = "your-tenant-id-here"
AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"

app = msal.PublicClientApplication(CLIENT_ID, authority=AUTHORITY)

# Device code flow
flow = app.initiate_device_flow(scopes=["User.Read"])
print(flow["message"])

result = app.acquire_token_by_device_flow(flow)
if "access_token" in result:
    print("Success! Access token acquired.")
else:
    print(f"Error: {result.get('error_description')}")
```

### Expected Results

**Success:**
- Browser opens for authentication (or device code shown)
- You authenticate with your Azure AD account
- Access token is returned
- You can call Microsoft Graph API

**Common first-time issues:**
- Redirect URI mismatch → Double-check URI in Authentication settings
- Insufficient permissions → Add required API permissions
- User consent required → Grant admin consent or user must consent

---

## Step 8: Review Configuration

### Checklist

- ✅ App registered with clear name
- ✅ Application ID and Tenant ID saved securely
- ✅ Redirect URI configured correctly
- ✅ API permissions added
- ✅ Admin consent granted (if required)
- ✅ Client secret created and saved (if needed)
- ✅ Authentication tested successfully

---

## Next Steps

### For Development

1. **Implement authentication in your app**
   - See [CONSOLE-APP-EXAMPLE.md](CONSOLE-APP-EXAMPLE.md)
   - Choose appropriate OAuth flow: [OAUTH-FLOWS.md](OAUTH-FLOWS.md)

2. **Call Microsoft Graph API**
   - Test with Graph Explorer: https://developer.microsoft.com/graph/graph-explorer
   - Add code to call APIs with access token

3. **Handle tokens properly**
   - Store tokens securely
   - Implement token refresh
   - Handle expiration gracefully

### For Production

1. **Security hardening**
   - Rotate client secrets regularly
   - Use certificates instead of secrets
   - Enable Conditional Access policies
   - Monitor sign-in logs

2. **Multi-environment setup**
   - Create separate app registrations for dev/test/prod
   - Use different client secrets per environment
   - Document all configurations

3. **Monitoring and maintenance**
   - Set up alerts for expiring secrets
   - Review API permissions periodically
   - Audit access logs regularly

---

## Common Questions

### Q: Can I have multiple redirect URIs?

**A:** Yes! Add as many as you need:
- Development: `http://localhost:3000`
- Staging: `https://staging.myapp.com/callback`
- Production: `https://myapp.com/callback`

### Q: What if I lost my client secret?

**A:** You cannot retrieve it. Create a new one:
1. Go to Certificates & secrets
2. Create new client secret
3. Update your app with the new secret
4. Delete the old secret once migration is complete

### Q: Do I need admin consent for all permissions?

**A:** No, only for:
- Application permissions (always require admin)
- High-privilege delegated permissions
- When user consent is disabled by policy

### Q: Can I change the tenant type later?

**A:** Yes! Go to Authentication → Supported account types and change it.

### Q: How do I delete an app registration?

**A:** Overview → Delete (top of page). It's recoverable for 30 days.

---

## Troubleshooting

### "App is not assigned to a service principal"

**Solution:**
```bash
az ad sp create --id YOUR_APP_ID
```

### "AADSTS50011: Redirect URI mismatch"

**Solution:**
- Check Authentication → Redirect URIs
- Ensure exact match (case-sensitive, trailing slash matters)
- Ensure correct platform (Web vs SPA vs Public client)

### "AADSTS65001: User consent required"

**Solution:**
- Grant admin consent in API permissions
- Or have user consent during first login

### "Cannot find app in tenant"

**Solution:**
- Verify you're in the correct tenant
- Check Application ID is correct
- Ensure service principal is created

---

## Summary

You've successfully:
- ✅ Created your first app registration
- ✅ Configured authentication settings
- ✅ Added API permissions
- ✅ Obtained client ID and tenant ID
- ✅ Tested basic authentication

**Next:** Integrate authentication into your application using the examples in [CONSOLE-APP-EXAMPLE.md](CONSOLE-APP-EXAMPLE.md)

---

## Additional Resources

- [Microsoft Entra ID Documentation](https://learn.microsoft.com/en-us/entra/identity-platform/)
- [Quickstart: Register an app](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Microsoft Graph Explorer](https://developer.microsoft.com/graph/graph-explorer)
- [MSAL Libraries](https://learn.microsoft.com/en-us/entra/msal/)
