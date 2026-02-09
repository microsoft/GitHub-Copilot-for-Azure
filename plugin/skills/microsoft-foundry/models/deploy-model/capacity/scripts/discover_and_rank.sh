#!/bin/bash
# discover_and_rank.sh
# Discovers available capacity for an Azure OpenAI model across all regions,
# cross-references with existing projects, and outputs a ranked table.
#
# Usage: ./discover_and_rank.sh <model-name> <model-version> [min-capacity]
# Example: ./discover_and_rank.sh o3-mini 2025-01-31 200
#
# Output: Ranked table of regions with capacity, project counts, and match status

set -euo pipefail

MODEL_NAME="${1:?Usage: $0 <model-name> <model-version> [min-capacity]}"
MODEL_VERSION="${2:?Usage: $0 <model-name> <model-version> [min-capacity]}"
MIN_CAPACITY="${3:-0}"

SUB_ID=$(az account show --query id -o tsv)

# Query model capacity across all regions (GlobalStandard SKU)
CAPACITY_JSON=$(az rest --method GET \
  --url "https://management.azure.com/subscriptions/${SUB_ID}/providers/Microsoft.CognitiveServices/modelCapacities" \
  --url-parameters api-version=2024-10-01 modelFormat=OpenAI modelName="$MODEL_NAME" modelVersion="$MODEL_VERSION" \
  2>/dev/null)

# Query all AI Services projects
PROJECTS_JSON=$(az rest --method GET \
  --url "https://management.azure.com/subscriptions/${SUB_ID}/providers/Microsoft.CognitiveServices/accounts" \
  --url-parameters api-version=2024-10-01 \
  --query "value[?kind=='AIServices'].{name:name, location:location}" \
  2>/dev/null)

# Combine, rank, and output using inline Python (available on all Azure CLI installs)
python3 -c "
import json, sys

capacity = json.loads('''${CAPACITY_JSON}''')
projects = json.loads('''${PROJECTS_JSON}''')
min_cap = int('${MIN_CAPACITY}')

# Build capacity map (GlobalStandard only)
cap_map = {}
for item in capacity.get('value', []):
    props = item.get('properties', {})
    if props.get('skuName') == 'GlobalStandard' and props.get('availableCapacity', 0) > 0:
        region = item.get('location', '')
        cap_map[region] = max(cap_map.get(region, 0), props['availableCapacity'])

# Build project count map
proj_map = {}
proj_sample = {}
for p in (projects if isinstance(projects, list) else []):
    loc = p.get('location', '')
    proj_map[loc] = proj_map.get(loc, 0) + 1
    if loc not in proj_sample:
        proj_sample[loc] = p.get('name', '')

# Combine and rank
results = []
for region, cap in cap_map.items():
    meets = cap >= min_cap
    results.append({
        'region': region,
        'available': cap,
        'meets': meets,
        'projects': proj_map.get(region, 0),
        'sample': proj_sample.get(region, '(none)')
    })

# Sort: meets target first, then by project count, then by capacity
results.sort(key=lambda x: (-x['meets'], -x['projects'], -x['available']))

# Output
total = len(results)
matching = sum(1 for r in results if r['meets'])
with_projects = sum(1 for r in results if r['meets'] and r['projects'] > 0)

print(f'Model: {\"${MODEL_NAME}\"} v{\"${MODEL_VERSION}\"} | SKU: GlobalStandard | Min Capacity: {min_cap}K TPM')
print(f'Regions with capacity: {total} | Meets target: {matching} | With projects: {with_projects}')
print()
print(f'{\"Region\":<22} {\"Available\":<12} {\"Meets Target\":<14} {\"Projects\":<10} {\"Sample Project\"}')
print('-' * 90)
for r in results:
    mark = 'YES' if r['meets'] else 'no'
    print(f'{r[\"region\"]:<22} {r[\"available\"]}K{\"\":.<10} {mark:<14} {r[\"projects\"]:<10} {r[\"sample\"]}')
"
