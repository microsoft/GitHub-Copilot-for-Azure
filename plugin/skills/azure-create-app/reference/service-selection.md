# Service Selection Rules

Use these rules when mapping application components to Azure services.

## Static Web Apps

**Use when:**
- Application is a static frontend (React, Vue, Angular, Svelte)
- Application is a Jamstack site (Gatsby, Hugo, Astro)
- Application needs global CDN distribution
- Application has optional serverless API

**Requirements:**
- Built files must be in a `dist` folder
- Reference this in `azure.yaml` using the `dist` property
- For plain HTML sites, create a `dist/` folder and copy deployable files there

## Container Apps

**Use when:**
- Application is a microservice or API
- Application is a full-stack web application
- Application needs background workers or queue processors
- Application needs scheduled jobs (use Container Apps Jobs)
- Application is already containerized with Docker

## Azure Functions

**Use when:**
- Application is event-driven serverless
- Application needs HTTP APIs with per-request billing
- Application needs timer-triggered jobs
- Application uses queue/blob/event triggers

## App Service

**Use when:**
- Application is a traditional web application
- Container Apps features are not needed
- Migrating existing App Service application

## Azure Kubernetes Service (AKS)

**Use when:**
- Application has complex Kubernetes requirements
- Application needs custom operators or CRDs
- Team has existing Kubernetes expertise
