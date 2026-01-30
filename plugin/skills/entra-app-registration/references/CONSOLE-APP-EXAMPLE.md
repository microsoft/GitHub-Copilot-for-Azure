# Console Application Examples

This document provides complete working examples of console applications that authenticate with Microsoft Entra ID using MSAL (Microsoft Authentication Library).

## Table of Contents

- [C# (.NET) Example](#c-net-example)
- [Python Example](#python-example)
- [JavaScript (Node.js) Example](#javascript-nodejs-example)

## C# (.NET) Example

### Prerequisites

```bash
dotnet new console -n EntraAuthConsole
cd EntraAuthConsole
dotnet add package Microsoft.Identity.Client
```

### Complete Code

```csharp
// Build MSAL client and acquire token
var app = PublicClientApplicationBuilder.Create("CLIENT_ID")
    .WithAuthority(AzureCloudInstance.AzurePublic, "TENANT_ID").Build();

var result = await app.AcquireTokenInteractive(new[] { "User.Read" })
    .WithPrompt(Prompt.SelectAccount).ExecuteAsync();

// Use token to call API
httpClient.DefaultRequestHeaders.Authorization = 
    new AuthenticationHeaderValue("Bearer", result.AccessToken);
```

### Run the Application

```bash
dotnet run
```

### Device Code Flow (for headless scenarios)

```csharp
// Use this for servers or devices without a browser
result = await app.AcquireTokenWithDeviceCode(Scopes, deviceCodeResult =>
{
    Console.WriteLine(deviceCodeResult.Message);
    return Task.CompletedTask;
}).ExecuteAsync();
```

---

## Python Example

### Prerequisites

```bash
pip install msal requests
```

### Complete Code

```python
import msal

# Create app and acquire token interactively
app = msal.PublicClientApplication("CLIENT_ID", 
    authority="https://login.microsoftonline.com/TENANT_ID")
result = app.acquire_token_interactive(scopes=["User.Read"])

# Use token to call API
headers = {'Authorization': f'Bearer {result["access_token"]}'}
response = requests.get('https://graph.microsoft.com/v1.0/me', headers=headers)
```

### Run the Application

```bash
python console_app.py
```

---

## JavaScript (Node.js) Example

### Prerequisites

```bash
npm init -y
npm install @azure/msal-node axios
```

### Complete Code

```javascript
const msal = require('@azure/msal-node');

// Create app and acquire token via device code flow
const pca = new msal.PublicClientApplication({
    auth: { clientId: "CLIENT_ID", authority: "https://login.microsoftonline.com/TENANT_ID" }
});
const result = await pca.acquireTokenByDeviceCode({
    scopes: ["User.Read"],
    deviceCodeCallback: (response) => console.log(response.message)
});
// Use result.accessToken to call APIs
```

### Run the Application

```bash
node console_app.js
```

## Next Steps

- Review [OAUTH-FLOWS.md](OAUTH-FLOWS.md) for flow details
- See [API-PERMISSIONS.md](API-PERMISSIONS.md) for permission setup
- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues

## Additional Resources

- [MSAL Libraries](https://learn.microsoft.com/entra/msal/)
