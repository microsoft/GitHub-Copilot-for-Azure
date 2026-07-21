#!/usr/bin/env bash
# Discover catalog inputs for a Foundry-managed OAuth (catalog_MCP) MCP connection,
# and classify which matching connectors actually use MANAGED OAuth.
#
# For each match it prints:
#   - toolEntityId   -> azd ai connection create --metadata toolEntityId=...
#   - connectorName  -> azd ai connection create --connector-name ... (objectId segment)
#   - serverUrl      -> azd ai connection create --target ...   (best-effort; see note)
#   - managedOAuth   -> true when the connector exposes an OAuth app Foundry can broker
#   - identityProvider / scopes  -> the OAuth provider + default scopes (managed only)
#
# Usage:  ./get-catalog-inputs.sh <connector-name-substring> [--managed-only]
# Example: ./get-catalog-inputs.sh github
#          ./get-catalog-inputs.sh github --managed-only
#
# Requires: az (logged in), curl, python. Catalog lives only in eastus.
#
# HOW MANAGED OAUTH IS DETECTED (mirrors the portal):
#   The thin asset-gallery search index does NOT carry auth metadata, so we read
#   it from the Logic Apps managedApis GET — the same source the portal's
#   deriveConnectorSecuritySchemes() uses. A connector is managed-OAuth when its
#   connectionParameters has an entry of type "oauthSetting". That entry also
#   yields identityProvider + scopes.
#
# NOTE on serverUrl: remotes[].url is often null in the index (verified for
# github). When empty, supply the connector's documented MCP endpoint as
# --target (e.g. github Copilot -> https://api.githubcopilot.com/mcp).
set -euo pipefail

NAME=""
MANAGED_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --managed-only) MANAGED_ONLY=1 ;;
    *) NAME="$arg" ;;
  esac
done
[ -n "$NAME" ] || { echo "usage: get-catalog-inputs.sh <connector-name-substring> [--managed-only]" >&2; exit 2; }

GALLERY="https://eastus.api.azureml.ms/asset-gallery/v1.0/tools"
# Prefer real `python`; the bare `python3` on Windows is often a broken Store alias.
PY="$(command -v python || command -v python3 || true)"
[ -n "$PY" ] || { echo "error: python (or python3) is required" >&2; exit 2; }

TOKEN=$(az account get-access-token --resource "https://management.azure.com" --query accessToken -o tsv)
SUB=$(az account show --query id -o tsv)

query_registry() {
  local container="$1"
  curl -sS -X POST "$GALLERY" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"freeTextSearch\":\"*\",\"filters\":[{\"field\":\"entityContainerId\",\"operator\":\"eq\",\"values\":[\"$container\"]},{\"field\":\"type\",\"operator\":\"eq\",\"values\":[\"tools\"]},{\"field\":\"annotations/name\",\"operator\":\"contains\",\"values\":[\"$NAME\"]}],\"pageSize\":20}"
}

# managedApis GET for one connector: prints "managed|identityProvider|scopes"
classify_connector() {
  local connector="$1"
  curl -sS "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.Web/locations/eastus/managedApis/$connector?api-version=2016-06-01" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null | "$PY" -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print("false||"); raise SystemExit
cp = (d.get("properties", {}) or {}).get("connectionParameters", {}) or {}
oauth = None
for v in cp.values():
    if v.get("type") == "oauthSetting":
        oauth = v.get("oAuthSettings", {}) or {}
        break
if oauth is None:
    print("false||")
else:
    ip = oauth.get("identityProvider", "")
    scopes = ",".join(oauth.get("scopes", []) or [])
    print(f"true|{ip}|{scopes}")
'
}

echo "# Querying public catalog (connectors-registry-prod-bl) for '$NAME'..." >&2
PUBLIC=$(query_registry "connectors-registry-prod-bl")
echo "# Querying private MCP registry (registry-prod-bl) for '$NAME'..." >&2
PRIVATE=$(query_registry "registry-prod-bl")

# 1. Extract the base rows (name/connectorName/toolEntityId/serverUrl) as TSV.
ROWS=$(printf '%s\x1e%s' "$PUBLIC" "$PRIVATE" | "$PY" -c '
import sys, json, re
seen = {}
for blob in sys.stdin.read().split("\x1e"):
    blob = blob.strip()
    if not blob:
        continue
    try:
        doc = json.loads(blob)
    except json.JSONDecodeError:
        continue
    for r in doc.get("value", []) or []:
        eid = r.get("entityId", "")
        m = re.search(r"objectId/([^/]+)", eid)
        remotes = (r.get("properties", {}) or {}).get("remotes") or [{}]
        seen[eid] = (
            (r.get("annotations", {}) or {}).get("name") or r.get("name") or "",
            m.group(1) if m else "",
            eid,
            remotes[0].get("url") or "",
        )
for name, conn, eid, url in seen.values():
    print(f"{name}\t{conn}\t{eid}\t{url}")
')

# 2. Classify each connector via managedApis and print a report.
COUNT=0
printf '\n'
while IFS=$'\t' read -r name conn eid url; do
  [ -n "$conn" ] || continue
  cls=$(classify_connector "$conn")
  managed="${cls%%|*}"; rest="${cls#*|}"; idp="${rest%%|*}"; scopes="${rest#*|}"
  if [ "$MANAGED_ONLY" = "1" ] && [ "$managed" != "true" ]; then
    continue
  fi
  COUNT=$((COUNT+1))
  echo "  name           : $name"
  echo "  connectorName  : $conn"
  echo "  toolEntityId   : $eid"
  echo "  serverUrl      : ${url:-<empty — use documented MCP URL>}"
  echo "  managedOAuth   : $managed"
  if [ "$managed" = "true" ]; then
    echo "  identityProvider: $idp"
    echo "  scopes         : ${scopes:-<none>}"
  fi
  echo
done <<< "$ROWS"
echo "# $COUNT connector(s)$([ "$MANAGED_ONLY" = 1 ] && echo ' with managed OAuth')."

cat >&2 <<'HINT'
# Next: pick a managedOAuth=true row, then create the connection:
#   azd ai connection create <name> \
#     --kind remote-tool --auth-type oauth2 \
#     --target        <serverUrl-or-documented-MCP-URL> \
#     --connector-name <connectorName> \
#     --metadata type=catalog_MCP \
#     --metadata toolEntityId=<toolEntityId> \
#     --project-endpoint "$FOUNDRY_PROJECT_ENDPOINT"
HINT
