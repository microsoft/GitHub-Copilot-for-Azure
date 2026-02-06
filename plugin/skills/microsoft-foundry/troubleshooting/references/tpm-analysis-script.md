# TPM Allocation Analysis Script

Understanding how TPM is distributed across all your deployments helps identify quota exhaustion.

## Diagnostic Script

```bash
# Save all deployments to file and analyze with Python
az cognitiveservices account deployment list \
  --name <resource-name> \
  --resource-group <resource-group> \
  -o json > /tmp/deployments.json

python3 << 'EOF'
import json

with open('/tmp/deployments.json') as f:
    deployments = json.load(f)

print("\n" + "="*60)
print("DEPLOYMENT TPM ALLOCATION ANALYSIS")
print("="*60)

total_tpm = 0
deployments_with_limits = []

for d in deployments:
    name = d['name']
    model = d['properties']['model']['name']
    sku = d.get('sku', {}).get('name', 'N/A')
    rate_limits = d['properties'].get('rateLimits', [])

    token_limit = next((r['count'] for r in rate_limits if r['key'] == 'token'), 0)
    request_limit = next((r['count'] for r in rate_limits if r['key'] == 'request'), 0)

    if token_limit > 0:
        deployments_with_limits.append({
            'name': name,
            'model': model,
            'sku': sku,
            'tpm': token_limit,
            'rpm': request_limit
        })
        total_tpm += token_limit

# Print deployments sorted by TPM
print(f"\n{'Deployment':<25} {'Model':<20} {'SKU':<20} {'TPM':>10} {'RPM':>8}")
print("-"*60)

for d in sorted(deployments_with_limits, key=lambda x: x['tpm'], reverse=True):
    print(f"{d['name']:<25} {d['model']:<20} {d['sku']:<20} {d['tpm']:>10.0f} {d['rpm']:>8.0f}")

print("-"*60)
print(f"{'TOTAL ALLOCATED':<65} {total_tpm:>10.0f} TPM")
print("\nCompare with regional quota to see available capacity")
print("="*60 + "\n")
EOF
```

## Key Insights

- Shows which deployments consume most TPM
- Reveals SKU types (different SKUs = different quota pools)
- Helps identify over-allocation or unused deployments
- Compare total with regional quota to see available capacity
