# App Service on Azure Stack Hub to Azure App Service

Use this guide to assess and migrate applications from Azure App Service on Azure Stack Hub to Azure App Service in Azure. Follow the skill's App Service assessment, code migration, and global rules.

## Assessment

Inventory every application and record:

- Owner, criticality, runtime/framework, current instances, utilization, and peak traffic
- OS-level, registry, COM, Windows service, custom runtime, and App Service sandbox dependencies
- Databases, file shares, internal APIs, queues, SMTP, third-party services, and monitoring
- Authentication, certificates, custom domains, secrets, and compliance requirements
- Inbound access, hybrid connectivity, DNS, isolation, residency, availability, and disaster recovery

For each dependency, decide whether it remains on-premises or Azure Stack Hub, migrates to Azure, or is replaced. Design VPN, ExpressRoute, VNet integration, private endpoints, and private DNS where retained dependencies require hybrid connectivity.

## Select the Target

App Service on Azure Stack Hub supports Windows code-based applications only; it does not support Linux hosting or containerized applications. Azure App Service introduces Linux and container hosting as new modernization options. Treat either choice as a replatform or modernization path, not a direct lift-and-shift: validate runtime and dependency compatibility, update deployment configuration, and test operational behavior.

| Workload | Recommended target |
|----------|--------------------|
| Cloud-ready app with minimal OS dependencies | Azure App Service |
| ASP.NET Framework app compatible with the App Service sandbox | Azure App Service on Windows |
| Portable ASP.NET Core, Java, Node.js, Python, or PHP app selected for OS modernization | Azure App Service on Linux after compatibility validation |
| Registry, COM, custom runtime, Windows-specific, or other OS-level dependencies | Managed Instance on Azure App Service |
| App selected for containerization during migration | Build and validate a container image, then assess App Service Containers, Container Apps, or AKS |

Choose a rehost, replatform, refactor, or modernize strategy per application. Record whether the target retains Windows hosting or introduces Linux or containers. Prefer phased waves: pilot, non-production, low-risk production, then business-critical production.

## Select the App Service Plan SKU

App Service on Azure Stack Hub offers Free, Shared, and Standard SKUs. Azure App Service also offers Premium v3, Premium M v3, Premium v4, and Premium M v4 plans for workloads that need greater performance, memory, scale, or production capabilities.

Do not map tiers by name alone. For each source plan, compare measured CPU, memory, instance count, traffic, scaling, availability, networking, deployment slot, and cost requirements against currently available Azure App Service plans in the target region.

| Source plan | Target guidance |
|-------------|-----------------|
| Free or Shared | Use an Azure Free or Shared plan only when its limits satisfy a development or test workload; otherwise select a dedicated tier |
| Standard | Start with Azure Standard, then assess Premium v3/v4 for higher performance, scale, availability, or feature requirements |
| Custom Azure Stack Hub SKU | No direct SKU mapping exists; select a supported built-in Azure App Service SKU from the measured capacity and feature requirements |

For memory-intensive workloads, assess Premium M v3 or Premium M v4. Confirm regional SKU availability before finalizing the target architecture, and use load testing to validate the selected instance size and scale-out settings.

## Migration Workflow

1. **Define success and rollback** - Set functional, performance, security, compliance, monitoring, recovery, and business sign-off criteria.
2. **Design the landing zone** - Confirm region and SKU availability, residency, zones, scale, networking, DNS, resource groups, and production/non-production separation.
3. **Provision the target** - Create the App Service plan or Managed Instance and required networking, Key Vault, Application Insights, Azure Monitor, data, and storage resources.
4. **Deploy the application** - Prefer source deployment through GitHub Actions, Azure Pipelines, or ZIP deployment. For complex IIS applications on Managed Instance, Web Deploy or FTP are also supported.
5. **Migrate configuration** - Move app settings and connection strings; replace secrets with Key Vault references; configure Microsoft Entra ID, managed identities, certificates, and custom domains.
6. **Migrate data** - Select Azure SQL Database, SQL Managed Instance, or SQL Server on Azure VMs based on compatibility. Replace file-share dependencies with Azure Files or Blob Storage. Configure backups, redundancy, and recovery.
7. **Validate** - Test sign-in, authorization, workflows, data, integrations, startup, load, scaling, certificates, and network controls. Confirm monitoring and operational runbooks.
8. **Cut over** - Deploy to a slot, complete testing, synchronize final data, freeze source changes, update DNS, monitor traffic, and retain rollback until acceptance criteria pass.
9. **Decommission** - Remove the Azure Stack Hub deployment only after explicit user confirmation and the rollback retention period.

## Assessment Output

Use the standard App Service assessment report. Set **Source Platform** to `Azure App Service on Azure Stack Hub` and include the source and target SKU, sizing rationale, target selection, retained dependencies, hybrid networking, migration wave, cutover plan, and rollback criteria.

## Microsoft Guidance

- [Benefits of migrating to Azure App Service](https://learn.microsoft.com/azure-stack/operator/app-service-benefits-migrate-to-azure)
- [Plan a migration to Azure App Service](https://learn.microsoft.com/azure-stack/operator/app-service-planning-migrate-to-azure)
- [Migrate to Azure App Service](https://learn.microsoft.com/azure-stack/operator/app-service-migrate-to-azure)