# AZD Recipe: Deploy

Deploy using Azure Developer CLI.

## Prerequisites

- Preparation Manifest status is `Validated`
- Azure authentication verified (`azd auth status`)

---

## Steps

### Step 5A: Environment Setup

Ensure AZD environment exists. Set subscription and location.

→ [azd/environment-setup.md](azd/environment-setup.md)

### Step 5B: Select Deployment Type

Choose the appropriate command.

→ [azd/deployment-types.md](azd/deployment-types.md)

### Step 5C: Execute Deployment

Run the deployment.

→ [azd/execute.md](azd/execute.md)

### Step 5D: Handle Errors (if needed)

Troubleshoot failures.

→ [azd/error-handling.md](azd/error-handling.md)

### Step 5E: Post-Deployment

Verify and monitor.

→ [azd/post-deployment.md](azd/post-deployment.md)

---

## Additional References

- [Environment Management](azd/environments.md)
- [Cleanup (Destructive)](azd/cleanup.md)

---

## Next Step

→ SKILL.md Step 7 (Update Manifest)
