---
name: azure-deploy
description: Deploy applications to Azure including deployment planning, infrastructure as code rules, application logs, CI/CD pipeline guidance, and architecture diagrams.
---

# Azure Deploy Skill

## Description
Deploy applications to Azure including deployment planning, infrastructure as code rules, application logs, CI/CD pipeline guidance, and architecture diagrams.

## Capabilities

- Generate deployment plans
- Get IaC (Bicep/Terraform) rules and guidelines
- Fetch application logs from deployed resources
- Get CI/CD pipeline guidance
- Generate architecture diagrams

## Tools Used

| Tool | Description |
|------|-------------|
| `deploy_plan_get` | Generates a deployment plan for Azure infrastructure and applications |
| `deploy_iac_rules_get` | Provides guidelines for creating Bicep/Terraform files |
| `deploy_app_logs_get` | Fetches logs from Container Apps, App Services, or Function Apps deployed through azd |
| `deploy_pipeline_guidance_get` | Guidance for creating CI/CD pipelines for Azure |
| `deploy_architecture_diagram_generate` | Generates Azure service architecture diagrams |

## Example Usage

### Generate Deployment Plan
> Create a deployment plan for my web application to Azure

### Get IaC Guidelines
> What are the best practices for writing Bicep files for this deployment?

### Fetch Application Logs
> Get the logs from my deployed Container App

### CI/CD Guidance
> How do I set up a GitHub Actions pipeline to deploy to Azure?

## Deployment Plan Output
Plans are generated to `.azure/plan.copilotmd` and include:
- Execution steps
- Recommended Azure services
- Infrastructure requirements
- Application topology

## Supported Deployment Targets
- Azure Container Apps
- Azure App Service
- Azure Functions
- Azure Kubernetes Service
- Static Web Apps

## Prerequisites
- Scan workspace to detect services
- Identify dependent services
- Configure Azure Developer CLI (azd)

## Notes
- Always scan the workspace before generating a deployment plan
- Plans integrate with Azure Developer CLI (azd)
- Logs require resources deployed through azd
 