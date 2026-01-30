# Select Deployment Type

Choose the appropriate deployment command.

## Options

| Scenario | Command | Use When |
|----------|---------|----------|
| Full deployment | `azd up` | First deployment, or infra + code changes |
| Infrastructure only | `azd provision` | Only infra changes, no code updates |
| Application only | `azd deploy` | Only code changes, infra exists |
| Single service | `azd deploy <service>` | Update one service only |

## Decision Guide

**First deployment?** → `azd up`

**Changed Bicep files?** → `azd up` or `azd provision`

**Only changed code?** → `azd deploy`

**Changed one service?** → `azd deploy <service-name>`
