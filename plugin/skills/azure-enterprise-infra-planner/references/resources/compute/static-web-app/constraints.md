## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **GitHub Repository** | Provide `repositoryUrl`, `branch`, and `repositoryToken`. A GitHub Actions workflow is auto-created in the repo. |
| **Azure DevOps** | Set `provider: 'DevOps'`. Provide `repositoryUrl` and `branch`. Pipeline is configured separately. |
| **Azure Functions (managed)** | API location in `buildProperties.apiLocation` deploys a managed Functions backend. Limited to HTTP triggers, C#, JavaScript, Python, Java. |
| **Linked Backend** | Use `linkedBackends` child resource to connect an existing Function App, Container App, or App Service as the API backend. Standard SKU required. |
| **Private Endpoint** | Only available with `Standard` SKU. Set up a Private Endpoint to restrict access to the static web app. |
| **Custom Domain** | Custom domains are child resources. Require DNS CNAME or TXT validation. Free SSL certificates are auto-provisioned. |
| **Enterprise-Grade CDN** | `Standard` SKU only. Enables Azure Front Door integration for advanced caching and edge capabilities. |
