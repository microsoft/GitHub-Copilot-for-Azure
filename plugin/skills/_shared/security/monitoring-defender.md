# Monitoring and Microsoft Defender for Cloud

## Monitoring Checklist

- [ ] Enable Microsoft Defender for Cloud
- [ ] Configure diagnostic logging
- [ ] Set up security alerts
- [ ] Enable audit logging

## Microsoft Defender for Cloud

```bash
# Enable Defender plans
az security pricing create \
  --name VirtualMachines \
  --tier Standard
```

## Security Assessment

Use Microsoft Defender for Cloud for:
- Security score
- Recommendations
- Compliance assessment
- Threat detection

## Best Practices

1. **Enable Defender** — For all production workloads
2. **Review security score** — Address high-priority recommendations
3. **Configure alerts** — Set up notifications for security events
4. **Diagnostic logs** — Enable for all resources, send to Log Analytics
5. **Audit logging** — Track administrative actions and access
