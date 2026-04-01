---
name: aws-fargate-to-container-apps
description: "Migrate containerized workloads from AWS Fargate to Azure Container Apps with assessment reports and deployment guidance. WHEN: migrate Fargate to Azure, migrate AWS containers to Azure, Fargate to Container Apps, assess AWS ECS migration, convert AWS Fargate to Azure, cross-cloud container migration from AWS, migrate ECS tasks to Azure Container Apps."
license: MIT
metadata:
  version: "1.0.1"
  author: Microsoft
---

# AWS Fargate to Azure Container Apps Migration

> **MIGRATION SKILL** — Assess and migrate containerized workloads from AWS Fargate (ECS/EKS) to Azure Container Apps with comprehensive analysis, service mapping, and deployment guidance.

## Quick Reference

| Item | Details |
|------|---------|
| Best for | Migrating AWS Fargate workloads to Azure Container Apps |
| Source | AWS Fargate (ECS/EKS tasks) |
| Target | Azure Container Apps |
| MCP Tools | mcp_azure_mcp_documentation, mcp_azure_mcp_get_bestpractices |
| CLI | az containerapp create, az containerapp update, az acr build |
| Related skills | azure-deploy, azure-cloud-migrate, azure-kubernetes |

## When to Use This Skill

Activate this skill when the user wants to:

- Migrate AWS Fargate tasks to Azure Container Apps
- Assess AWS ECS/EKS Fargate workloads for Azure migration
- Convert AWS Fargate task definitions to Azure Container Apps YAML
- Migrate container workloads from AWS to Azure
- Plan cross-cloud container migration from AWS to Azure
- Understand service mapping between AWS Fargate and Azure Container Apps

## Rules

1. Follow migration phases sequentially — assessment before migration
2. Generate comprehensive assessment report before any code changes
3. Create output directory `<source-folder>-azure/` at workspace root
4. Never modify source AWS configuration files
5. Use Azure MCP tools for documentation and best practices
6. Map AWS service dependencies to Azure equivalents
7. Validate container image compatibility
8. Destructive actions (deployments) require user confirmation
9. Track progress in `migration-status.md`

## Required Inputs (Ask only what's needed)

If the user is unsure, provide safe defaults or guide discovery:

- AWS Fargate configuration location (task definitions, ECS services)
- Target Azure subscription and resource group
- Target Azure region
- Container registry preference (Azure Container Registry or existing)
- Networking requirements (VNet integration, ingress/egress)
- Environment variables and secrets strategy
- Scaling requirements (min/max replicas)

## Migration Workflow

### Phase 1: Discovery & Assessment

1. **Locate AWS Configuration**: Find task definitions, service definitions, or ECS/EKS configs
2. **Analyze Components**:
   - Container images and repositories
   - CPU/memory allocations
   - Environment variables and secrets (AWS Secrets Manager, Parameter Store)
   - IAM roles and permissions
   - Networking (VPC, security groups, load balancers)
   - Service dependencies (RDS, S3, DynamoDB, SQS, etc.)
   - Logging and monitoring (CloudWatch)
   - Auto-scaling policies
3. **Generate Assessment Report** → `<source-folder>-azure/assessment-report.md`:
   - Source workload inventory
   - Service mapping (AWS → Azure)
   - Compatibility analysis
   - Migration complexity rating
   - Cost estimation
   - Recommended Azure services
   - Required changes and considerations

📋 **See detailed assessment checklist**: [references/assessment-guide.md](references/assessment-guide.md)

### Phase 2: Service Mapping

Map AWS Fargate components to Azure equivalents:

| AWS Service | Azure Equivalent | Notes |
|-------------|------------------|-------|
| ECS/EKS Fargate | Azure Container Apps | Serverless container platform |
| ECR | Azure Container Registry | Private container registry |
| Application Load Balancer | Container Apps Ingress | Built-in with automatic HTTPS |
| AWS Secrets Manager | Azure Key Vault | Managed secrets with Container Apps integration |
| CloudWatch Logs | Azure Monitor/Log Analytics | Built-in Container Apps integration |
| CloudWatch Metrics | Azure Monitor Metrics | Auto-configured for Container Apps |
| IAM Roles (tasks) | Managed Identity | Azure AD integration |
| VPC | Virtual Network | VNet integration for Container Apps |
| Security Groups | NSG + Container Apps rules | Network security |
| Auto Scaling | Container Apps scaling rules | HTTP, CPU, memory, custom triggers |
| AWS Parameter Store | App Configuration or Key Vault | Configuration management |

### Phase 3: Configuration Conversion

1. **Convert Task Definitions**:
   - Transform ECS task definitions to Container Apps YAML
   - Map CPU/memory to Container Apps resource limits
   - Convert environment variables
   - Update secret references to Key Vault
2. **Create Infrastructure Files** in `<source-folder>-azure/`:
   - `containerapp.yaml` — Container Apps configuration
   - `main.bicep` or `main.tf` — Infrastructure as Code (prefer Bicep)
   - `env-vars.yaml` — Environment configuration
   - `secrets.txt` — List of secrets to configure (values not included)
3. **Migration Scripts**:
   - `deploy.sh` or `deploy.ps1` — Deployment automation
   - `setup-resources.sh` — Resource group, registry, environment setup

### Phase 4: Pre-Migration Preparation

1. **Container Registry**:
   - Create or use existing Azure Container Registry
   - Migrate container images from ECR to ACR
   - Update image references in configurations
2. **Azure Resources**:
   - Create resource group
   - Create Container Apps Environment
   - Configure Virtual Network (if required)
   - Set up Azure Key Vault for secrets
   - Configure Log Analytics workspace
3. **Dependencies**:
   - Identify and migrate/map dependent services
   - Update connection strings and endpoints
   - Configure managed identities

### Phase 5: Deployment

1. **Deploy Container Apps**:
   - Create Container Apps with converted configuration
   - Configure ingress rules
   - Set up custom domains (if needed)
   - Configure scaling rules
2. **Configure Monitoring**:
   - Enable Azure Monitor integration
   - Set up log streaming
   - Configure alerts and dashboards
3. **Testing Checklist** in `<source-folder>-azure/testing-checklist.md`:
   - Container startup and health checks
   - Application functionality
   - Environment variables and secrets
   - Network connectivity
   - Scaling behavior
   - Logging and monitoring
   - Performance comparison

🚀 **See detailed deployment instructions**: [references/deployment-guide.md](references/deployment-guide.md)

### Phase 6: Optimization

1. **Review and optimize**:
   - Cost analysis and optimization
   - Performance tuning
   - Security hardening
   - Scaling rules refinement
2. **Document**:
   - Architecture changes
   - Operational procedures
   - Rollback plan

## Output Directory Structure

All migration artifacts created in `<source-folder>-azure/`:

```
<source-folder>-azure/
├── migration-status.md          # Progress tracking
├── assessment-report.md         # Detailed analysis
├── containerapp.yaml            # Container Apps spec
├── main.bicep                   # Infrastructure as Code
├── env-vars.yaml                # Environment configuration
├── secrets.txt                  # Secrets reference list
├── testing-checklist.md         # Validation steps
├── deploy.sh                    # Deployment script
└── docs/
    ├── architecture.md          # Architecture documentation
    ├── service-mapping.md       # AWS to Azure mapping details
    └── operational-guide.md     # Operations and maintenance
```

## Guardrails / Safety

- Do not output secret values in files or logs
- Always ask for confirmation before deploying to Azure
- Never modify source AWS configurations
- Validate Azure region supports Container Apps
- Check Azure subscription quotas before deployment
- Use managed identities instead of connection strings when possible
- Enable HTTPS ingress by default
- Document all manual steps required

## MCP Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| mcp_azure_mcp_documentation | Get official Azure Container Apps documentation | Query for specific features and configurations |
| mcp_azure_mcp_get_bestpractices | Retrieve Container Apps best practices | Request guidance for security, networking, scaling |

## Error Handling

| Error | Likely Cause | Resolution |
|-------|--------------|------------|
| Image pull fails | ACR authentication or image not migrated | Verify ACR access, check image exists, configure managed identity |
| Container fails to start | Configuration mismatch or missing dependencies | Review logs with `az containerapp logs`, validate environment variables |
| Networking issues | VNet integration misconfigured | Verify subnet delegation, NSG rules, and private DNS |
| Secrets not accessible | Key Vault permissions missing | Grant Container Apps managed identity Key Vault access |
| Scaling not working | Invalid scaling rules | Review and adjust scaling triggers and thresholds |

## Completion Criteria

Before marking migration complete:

- [ ] Assessment report generated and reviewed
- [ ] All container images migrated to ACR
- [ ] Container Apps deployed successfully
- [ ] All environment variables and secrets configured
- [ ] Networking and ingress tested
- [ ] Dependent services connected and tested
- [ ] Monitoring and logging operational
- [ ] Documentation complete
- [ ] User confirms application functionality

Ask User: **"Migration complete. Would you like to review the deployment, optimize costs, or proceed with production cutover?"**
