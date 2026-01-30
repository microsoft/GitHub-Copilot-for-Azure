# Environment Management

Manage multiple AZD environments.

## Create Environments

```bash
azd env new dev
azd env new staging
azd env new prod
```

## Switch Environment

```bash
azd env select prod
```

## Deploy to Specific Environment

```bash
azd up --environment dev --no-prompt
azd up --environment staging --no-prompt
azd up --environment prod --no-prompt
```

## View Configuration

```bash
azd env list
azd env get-values
```

## Environment Isolation

Each environment:
- Has its own `.azure/<env>/.env` file
- Deploys to separate resource groups
- Uses unique resource names
