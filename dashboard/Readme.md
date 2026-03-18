# Skill Health Dashboard

A web app that displays skill health status and scheduled integration test results, helping skill owners track quality and investigate test failures.

## Architecture

The dashboard consists of three core components:

- **Static Web App** — the frontend UI for viewing and interacting with data
- **Function App** — the backend API that reads and processes raw data
- **Storage Account** — stores raw integration test data

Supporting resources include a Managed Identity with RBAC role assignments for authorization and Application Insights for observability.

The backend reads raw data from the storage account, processes it, and serves it to the frontend via API. The frontend queries the backend and renders the results.

## File Structure

All project files live under `dashboard/`. The following tree highlights key locations:

```
dashboard/
├── api/
│   └── ... Backend function app source code
├── assets/
│   └── ... Inline frontend source files
├── infra/
│   └── ... Bicep IaC for Azure resource provisioning
├── public/
│   └── data/
│       └── ... Static health status data files
└── src/
    └── nightly-runs/
        └── ... Nightly-runs view frontend source code
```

## Local Development

Both the frontend and backend can be run locally for development and debugging.

### Prerequisites

- Node.js
- Azure Functions Core Tools (CLI)
- Azure CLI
- An active Azure subscription

### Backend

From the `dashboard/api/` directory:

```bash
npm install
npm run build
func start --port 7071
```

The default configuration points the frontend at `http://localhost:7071` for API requests. To use a different port, update the proxy setting in `vite.config.ts` as well.

When running locally, the backend authenticates with `AzureCliCredential` instead of `ManagedIdentityCredential`. Make sure you are signed in via Azure CLI if you need to access the storage account.

Some environment variables that are automatically set in Azure (e.g., `STORAGE_ACCOUNT_NAME`) must be configured manually in your local environment.

### Frontend

From the `dashboard/` directory:

```bash
npm install
npm run build
npm run dev
```

Open the URL printed in the terminal. With the local backend running, all features should be fully functional.

## Deployment

This project supports [Azure Developer CLI (azd)](https://learn.microsoft.com/azure/developer/azure-developer-cli/). To deploy:

```bash
cd dashboard
azd init
azd up
```

You will be prompted to authenticate and select an Azure subscription and location.
