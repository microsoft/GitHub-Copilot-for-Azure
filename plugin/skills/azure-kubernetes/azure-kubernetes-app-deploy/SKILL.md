---
name: deploy-to-aks
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
description: "Use when deploying a web application or API to an existing Azure Kubernetes Service cluster. Detects framework, generates Dockerfile and Kubernetes manifests, validates against AKS Deployment Safeguards, and deploys with verification. WHEN: deploy to AKS, deploy app to Kubernetes, containerize for AKS, deploy to existing AKS cluster, generate K8s manifests for Azure, set up CI/CD for AKS, migrate app to AKS, deploy container to Azure, I have a Django/Express/Spring Boot app and want to run it on AKS, my AKS deployment is failing safeguard checks."
---

# Deploy to AKS

Deploy applications to an existing AKS cluster with production-grade artifacts. Detects the framework, generates Dockerfile + K8s manifests, validates against Deployment Safeguards, and deploys — with minimal questions.

## When to Use This Skill

**Use this skill when:**
- You want to deploy an existing web application or API to an AKS cluster
- You need to containerize an app for Kubernetes and generate deployment manifests
- Your AKS deployment is failing Deployment Safeguard checks (DS001–DS013) and you need guidance
- You want to set up or improve CI/CD pipelines for AKS deployments
- You're migrating an application from another platform to AKS

**Do NOT use this skill for:**
- Provisioning or creating a new AKS cluster (use a separate provisioning skill)
- Deploying to non-AKS compute targets (Web Apps, Container Apps, etc.)
- Managing cluster infrastructure, scaling policies, or node pools
- Performing Kubernetes cluster administration tasks (RBAC, networking policies, etc.)

## MCP Tools

| Tool | Purpose | Required |
|------|---------|----------|
| `azure-documentation` | Fetch Azure documentation and configuration references | Yes |
| Terminal commands | Execute `kubectl`, `az`, `docker`, `gh` CLI commands | Yes |

## Error Handling

| Error | Likely Cause | Recovery |
|-------|--------------|----------|
| Safeguard validation failure (DS001–DS013) | Manifest violates deployment best practices (missing resource limits, security policies, etc.) | Review the safeguard checklist in `references/safeguards.md`, apply recommended fixes, re-validate |
| Image push fails to ACR | ACR not attached to cluster or authentication token expired | Run `az acr login --name <registry>`, verify ACR attachment with `az aks check-acr`, retry push |
| `kubectl apply` fails | Manifest syntax error or unsupported API version | Check manifest YAML syntax, verify API version compatibility with cluster Kubernetes version using `kubectl api-resources` |
| Pod CrashLoopBackOff | Application fails to start (missing env vars, config, port mismatch) | Check logs with `kubectl logs <pod>`, verify health endpoint config, ensure all required environment variables are set in ConfigMap/Secrets |
| Workload Identity auth failure | OIDC not configured or service account not mapped | Follow `references/workload-identity.md` to set up federated identity credentials and service account annotations |
| Deployment rollout stuck | Resource quota exceeded or image pull failure | Check `kubectl describe deployment`, verify resource requests fit quota, ensure image pull secrets are configured, check node readiness |

## Prerequisites

- An existing AKS cluster
- Azure CLI authenticated (`az login`)
- `kubectl` configured for the target cluster

## Workflow

Follow the quick deploy workflow in `phases/quick-deploy.md`. The workflow has 5 sections:

1. **Detection** — scan project for framework/port/health endpoints; detect AKS cluster, ACR, routing mode
2. **File Generation** — generate Dockerfile + K8s manifests from templates
3. **Safeguards Validation** — validate manifests against AKS Deployment Safeguards DS001-DS013
4. **Deploy** — build image, push to ACR, apply manifests
5. **Verify** — confirm pods running, external IP available, health check passing

## Quick Reference

| Property | Value |
|----------|-------|
| Best for | Deploying apps to an existing AKS cluster |
| MCP Tools | `azure-documentation` |
| CLI | `az acr build`, `kubectl apply`, `kubectl rollout status` |
| Related skills | azure-kubernetes (cluster provisioning), azure-diagnostics (troubleshooting) |

## Workflow Quick Reference

| Step | Read | Also load |
|------|------|-----------|
| Quick Deploy | `phases/quick-deploy.md` | `references/detection.md`, `knowledge-packs/frameworks/<detected>.md` (if exists), `references/safeguards.md`, `references/workload-identity.md`, `references/rollback.md` (on failure) |

## References

Load these on-demand based on workflow phase:

- [detection.md](./references/detection.md) — framework, port, and health endpoint detection tables
- [safeguards.md](./references/safeguards.md) — AKS Deployment Safeguards DS001-DS013 checklist
- [workload-identity.md](./references/workload-identity.md) — Azure Workload Identity setup for AKS pods
- [rollback.md](./references/rollback.md) — recovery procedures for deployment failures

## Knowledge Packs

After detecting the framework, load the matching pack from `knowledge-packs/frameworks/` if available. Packs provide framework-specific Dockerfile patterns, health endpoints, database config, and writable path requirements.

Available: `spring-boot`, `express`, `nextjs`, `fastapi`, `django`, `nestjs`, `aspnet-core`, `go`, `flask`

## Templates

Templates are starting points — replace `<angle-bracket>` placeholders with detected values.

| Category | Directory | Files |
|----------|-----------|-------|
| Dockerfiles | `templates/dockerfiles/` | node, python, java, go, dotnet, rust (+ matching `.dockerignore` per language) |
| K8s manifests | `templates/k8s/` | namespace, deployment, service, ingress, gateway, httproute, hpa, pdb, serviceaccount, configmap, networkpolicy |
| CI/CD | `templates/github-actions/` | deploy.yml |
| Diagrams | `templates/mermaid/` | architecture-diagram, summary-dashboard |

## Execution Model

- **Generate artifacts automatically** — Dockerfiles, manifests, workflows
- **Execute CLI commands only with confirmation** — `az`, `docker`, `kubectl`, `gh`
- **Detect before create** — check for existing Dockerfiles, manifests, CI/CD
- **Validate before replace** — improve what exists rather than overwriting

## Key Principles

- ONE concept per turn — never overload the developer
- Sensible defaults — Ingress (Web App Routing), Workload Identity, 2 replicas
- Teach while fixing — when auto-fixing Safeguard violations, explain why
