# EF Core Migrations Deployment

Apply Entity Framework Core migrations to Azure SQL Database during or after deployment.

## Overview

EF Core migrations define database schema changes as code. After provisioning Azure SQL Database, migrations must be applied to create tables, indexes, and constraints.

## Detection

Look for EF Core projects:

| Indicator | Location |
|-----------|----------|
| `Migrations/` folder | Project root or `Data/` directory |
| `Microsoft.EntityFrameworkCore` package | `.csproj` file references |
| `DbContext` classes | Source code |
| `dotnet ef` commands | Project supports EF tooling |

**Quick Check:**

```bash
# Check for Migrations folder
find . -type d -name "Migrations" 2>/dev/null

# Check for EF Core package references
find . -name "*.csproj" -exec grep -l "Microsoft.EntityFrameworkCore" {} \;
```

## Deployment Methods

### Method 1: azd Hook (Recommended)

Automate migration application using `postprovision` hook.

#### azure.yaml

```yaml
name: myapp

services:
  api:
    project: ./src/api
    language: dotnet
    host: appservice

hooks:
  postprovision:
    shell: sh
    run: ./scripts/apply-migrations.sh
```

#### scripts/apply-migrations.sh

```bash
#!/bin/bash
set -e

# Load azd environment variables
eval $(azd env get-values)

# Build connection string
CONNECTION_STRING="Server=tcp:${SQL_SERVER}.database.windows.net,1433;Database=${SQL_DATABASE};Authentication=Active Directory Default;Encrypt=True;"

echo "Applying EF Core migrations to $SQL_DATABASE..."

# Apply migrations using dotnet ef
cd src/api  # Adjust path to your project
dotnet ef database update --connection "$CONNECTION_STRING"

echo "Migrations applied successfully."
```

#### scripts/apply-migrations.ps1

```powershell
#!/usr/bin/env pwsh

# Load environment variables from azd
azd env get-values | ForEach-Object {
    $parts = $_ -split '=', 2
    if ($parts.Length -eq 2) {
        Set-Variable -Name $parts[0] -Value $parts[1]
    }
}

# Build connection string
$connectionString = "Server=tcp:$SQL_SERVER.database.windows.net,1433;Database=$SQL_DATABASE;Authentication=Active Directory Default;Encrypt=True;"

Write-Host "Applying EF Core migrations to $SQL_DATABASE..."

# Apply migrations
Push-Location src/api  # Adjust path to your project
try {
    dotnet ef database update --connection $connectionString
    Write-Host "Migrations applied successfully."
} finally {
    Pop-Location
}
```

> 💡 **Tip:** Make script executable: `chmod +x scripts/*.sh`

### Method 2: SQL Script Generation (Production)

Generate idempotent SQL scripts for controlled deployments.

```bash
# Generate idempotent migration script
cd src/api
dotnet ef migrations script --idempotent --output migrations.sql

# Review the script
cat migrations.sql

# Apply using Azure CLI
SQL_SERVER=$(azd env get-values | grep SQL_SERVER | cut -d'=' -f2)
SQL_DATABASE=$(azd env get-values | grep SQL_DATABASE | cut -d'=' -f2)
RESOURCE_GROUP=$(azd env get-values | grep AZURE_RESOURCE_GROUP | cut -d'=' -f2)

az sql db query \
  --server "$SQL_SERVER" \
  --database "$SQL_DATABASE" \
  --resource-group "$RESOURCE_GROUP" \
  --auth-mode ActiveDirectoryDefault \
  --queries "$(cat migrations.sql)"
```

**Benefits:**
- Review changes before applying
- Version control SQL scripts
- Manual approval workflows
- Repeatable (idempotent)

### Method 3: Application Startup (Development Only)

Apply migrations automatically when application starts.

⚠️ **WARNING:** Only use in development. Production deployments should use explicit migration steps.

#### Program.cs

```csharp
var builder = WebApplication.CreateBuilder(args);

// Configure services
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions => sqlOptions.EnableRetryOnFailure()
    ));

var app = builder.Build();

// Apply migrations on startup (DEVELOPMENT ONLY)
if (app.Environment.IsDevelopment() || 
    builder.Configuration.GetValue<bool>("ApplyMigrationsOnStartup"))
{
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        dbContext.Database.Migrate();
    }
}

app.Run();
```

**Configuration (appsettings.json):**

```json
{
  "ApplyMigrationsOnStartup": false,
  "ConnectionStrings": {
    "DefaultConnection": "Server=tcp:${SQL_SERVER}.database.windows.net,1433;Database=${SQL_DATABASE};Authentication=Active Directory Default;Encrypt=True;"
  }
}
```

## Combined Hook: SQL Access + Migrations

Combine both post-deployment steps in one hook.

### scripts/post-provision.sh

```bash
#!/bin/bash
set -e

# Load azd environment variables
eval $(azd env get-values)

echo "=== Post-Provisioning Setup ==="

# Step 1: Grant SQL access
echo "1. Granting SQL access to $SERVICE_API_NAME..."
az sql db query \
  --server "$SQL_SERVER" \
  --database "$SQL_DATABASE" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --auth-mode ActiveDirectoryDefault \
  --queries "
    IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = '$SERVICE_API_NAME')
    BEGIN
        CREATE USER [$SERVICE_API_NAME] FROM EXTERNAL PROVIDER;
    END
    ALTER ROLE db_datareader ADD MEMBER [$SERVICE_API_NAME];
    ALTER ROLE db_datawriter ADD MEMBER [$SERVICE_API_NAME];
    ALTER ROLE db_ddladmin ADD MEMBER [$SERVICE_API_NAME];
  " || echo "Note: User may already exist."

echo "✓ SQL access granted."

# Step 2: Apply EF migrations
echo "2. Applying EF Core migrations..."
CONNECTION_STRING="Server=tcp:${SQL_SERVER}.database.windows.net,1433;Database=${SQL_DATABASE};Authentication=Active Directory Default;Encrypt=True;"

cd src/api  # Adjust to your project path
dotnet ef database update --connection "$CONNECTION_STRING"

echo "✓ Migrations applied."
echo "=== Post-Provisioning Complete ==="
```

### scripts/post-provision.ps1

```powershell
#!/usr/bin/env pwsh

# Load environment variables from azd
azd env get-values | ForEach-Object {
    $parts = $_ -split '=', 2
    if ($parts.Length -eq 2) {
        Set-Variable -Name $parts[0] -Value $parts[1]
    }
}

Write-Host "=== Post-Provisioning Setup ===" -ForegroundColor Cyan

# Step 1: Grant SQL access
Write-Host "1. Granting SQL access to $SERVICE_API_NAME..." -ForegroundColor Yellow

$grantQuery = @"
    IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = '$SERVICE_API_NAME')
    BEGIN
        CREATE USER [$SERVICE_API_NAME] FROM EXTERNAL PROVIDER;
    END
    ALTER ROLE db_datareader ADD MEMBER [$SERVICE_API_NAME];
    ALTER ROLE db_datawriter ADD MEMBER [$SERVICE_API_NAME];
    ALTER ROLE db_ddladmin ADD MEMBER [$SERVICE_API_NAME];
"@

try {
    az sql db query `
      --server $SQL_SERVER `
      --database $SQL_DATABASE `
      --resource-group $AZURE_RESOURCE_GROUP `
      --auth-mode ActiveDirectoryDefault `
      --queries $grantQuery
    Write-Host "✓ SQL access granted." -ForegroundColor Green
} catch {
    Write-Warning "Note: User may already exist."
}

# Step 2: Apply EF migrations
Write-Host "2. Applying EF Core migrations..." -ForegroundColor Yellow
$connectionString = "Server=tcp:$SQL_SERVER.database.windows.net,1433;Database=$SQL_DATABASE;Authentication=Active Directory Default;Encrypt=True;"

Push-Location src/api  # Adjust to your project path
try {
    dotnet ef database update --connection $connectionString
    Write-Host "✓ Migrations applied." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host "=== Post-Provisioning Complete ===" -ForegroundColor Cyan
```

## Prerequisites

### Install EF Core Tools

```bash
# Global tool (recommended)
dotnet tool install --global dotnet-ef

# Or project-local tool
dotnet new tool-manifest
dotnet tool install dotnet-ef
```

### Verify Installation

```bash
dotnet ef --version
```

**Expected Output:** `Entity Framework Core .NET Command-line Tools`

## Connection String Formats

### Managed Identity (Recommended)

```
Server=tcp:{server}.database.windows.net,1433;Database={database};Authentication=Active Directory Default;Encrypt=True;
```

### Access Token (Alternative)

```bash
# Get token
TOKEN=$(az account get-access-token --resource https://database.windows.net --query accessToken -o tsv)

# Connection string with token
"Server=tcp:${SQL_SERVER}.database.windows.net,1433;Database=${SQL_DATABASE};Authentication=Active Directory Access Token;AccessToken=${TOKEN};Encrypt=True;"
```

## Troubleshooting

### Error: "Cannot open database requested by the login"

**Cause:** Database name mismatch or firewall rules.

**Solution:**

```bash
# Verify database exists
az sql db show --name "$SQL_DATABASE" --server "$SQL_SERVER" --resource-group "$RESOURCE_GROUP"

# Check firewall rules
az sql server firewall-rule list --server "$SQL_SERVER" --resource-group "$RESOURCE_GROUP"

# Add your IP temporarily
MY_IP=$(curl -s https://api.ipify.org)
az sql server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --server "$SQL_SERVER" \
  --name "TempAccess" \
  --start-ip-address "$MY_IP" \
  --end-ip-address "$MY_IP"
```

### Error: "Login failed for user"

**Cause:** Managed identity or user lacks database permissions.

**Solution:** Grant SQL access per [sql-managed-identity.md](sql-managed-identity.md)

### Error: "Unable to create an object of type 'ApplicationDbContext'"

**Cause:** Missing design-time DbContext factory or connection string.

**Solution:**

```csharp
// Add IDesignTimeDbContextFactory
public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        
        // Use connection string from environment or args
        var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING")
            ?? args.FirstOrDefault()
            ?? "Server=(localdb)\\mssqllocaldb;Database=MyDb;Trusted_Connection=True;";
        
        optionsBuilder.UseSqlServer(connectionString);
        return new ApplicationDbContext(optionsBuilder.Options);
    }
}
```

### Hook Fails but Deployment Continues

**Cause:** azd hooks use `|| true` pattern to prevent failures from blocking deployment.

**Solution:** Remove `|| true` from hook script if you want migrations to block deployment on failure:

```bash
# Will fail deployment if migrations fail
dotnet ef database update --connection "$CONNECTION_STRING"

# vs.

# Will warn but continue deployment if migrations fail
dotnet ef database update --connection "$CONNECTION_STRING" || echo "Warning: Migrations failed"
```

## Best Practices

1. **Generate idempotent scripts** — Use `--idempotent` flag for production
2. **Version control migrations** — Commit Migrations/ folder
3. **Test migrations locally** — Run `dotnet ef database update` before deploying
4. **Backup before applying** — Especially in production environments
5. **Monitor hook execution** — Check azd output for migration success/failure
6. **Keep migrations small** — Frequent, focused changes easier to troubleshoot

## References

- [SQL Managed Identity Access](sql-managed-identity.md)
- [Post-Deployment Guide](post-deployment.md)
- [EF Core Migrations Documentation](https://learn.microsoft.com/ef/core/managing-schemas/migrations/)
