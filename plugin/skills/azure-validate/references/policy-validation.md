# Azure Policy Validation

## Review Policy Compliance

When validating Azure policies for your subscription:

- **Check for policy violations** — Identify any resources or configurations that don't comply with assigned policies
- **Verify organizational compliance** — Ensure the planned deployment meets all organizational policy requirements
- **Address policy conflicts** — Resolve any policy issues before proceeding to deployment

## Common Policy Issues

| Issue | Resolution |
|-------|------------|
| Non-compliant resource SKUs | Update resource SKUs to comply with allowed values |
| Missing required tags | Add required tags to resources in your infrastructure code |
| Disallowed resource types | Replace with allowed alternatives or request policy exception |
| Location restrictions | Deploy to allowed regions only |
| Network security violations | Update NSG rules, firewall settings, or virtual network configurations |

## Next Steps

Only proceed to deployment after all policy violations are resolved and compliance is confirmed.
