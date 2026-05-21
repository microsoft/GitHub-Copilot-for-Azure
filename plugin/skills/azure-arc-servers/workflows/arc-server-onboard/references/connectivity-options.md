# Arc Server Connectivity Options

How the Connected Machine agent talks to Azure. The user picks one
primary path; combinations are possible but rare.

## The four primary paths

```text
Machine on the internet?
├── Yes, direct outbound 443  ─────────────────────────→ Public endpoint
├── Yes, but through corporate proxy  ─────────────────→ Public endpoint + proxy
├── No internet, only private ExpressRoute / VPN  ─────→ Private Link Scope
├── No internet, but want one egress point  ──────────→ Arc Gateway (alone or w/ Private Link)
└── Air-gapped / disconnected operations  ─────────────→ Edge / Air-gapped cloud (alt endpoints)
```

The portal exposes the choice via the `ConnectivityMethod` enum in
`Client/React/Views/ArcServers/Enums.d.ts`:

```ts
export const enum ConnectivityMethod {
    PublicEndpoint = "publicEndpoint",
    PrivateLink = "privateLink",
}
```

Arc Gateway is an orthogonal toggle that overlays on top of either
`PublicEndpoint` or `PrivateLink` and is gated by the `arcservergateways`
feature flag.

## Public endpoint

The default. The machine reaches Azure over the public internet using
the endpoints listed in
[prerequisites.md](prerequisites.md#network-egress-minimum-endpoint-set).

**No extra Azure resources needed.**

### Add a proxy

For machines behind a corporate proxy, pass the proxy URL at install
time:

```powershell
# Windows install snippet
$env:ArcOnboardingProxy = "http://proxy.contoso.com:8080"
& "$env:ProgramFiles\AzureConnectedMachineAgent\azcmagent.exe" connect `
    --resource-group $rg `
    --tenant-id $tenant `
    --location $region `
    --subscription-id $sub `
    --proxy-url $env:ArcOnboardingProxy
```

```bash
# Linux install snippet
sudo azcmagent connect \
    --resource-group "$RG" \
    --tenant-id "$TENANT" \
    --location "$REGION" \
    --subscription-id "$SUB" \
    --proxy-url "http://proxy.contoso.com:8080"
```

If the proxy requires auth, set credentials via the agent config file
or environment variables - do not bake them into the install command.

### Add proxy bypass

If specific endpoints (e.g. internal package mirrors) should bypass the
proxy:

```bash
azcmagent config set proxy.bypass "ArcData,ArcServer,WAC"
```

(Use the symbolic bypass names; `azcmagent config list proxy.bypass`
shows what's available.)

## Private Link Scope (AMPLS for Arc)

Pre-creates a `Microsoft.HybridCompute/privateLinkScopes` resource and
associates the machine with it during onboarding. All Arc traffic flows
over private IPs via a Private Endpoint into the user's VNet.

### When to choose

- Compliance requires no public internet egress for the machine.
- The machine is on an isolated VNet reachable only over ExpressRoute /
  VPN.
- The user wants per-scope DNS, audit, and IP control.

### Costs / setup

- One Private Link Scope per region you onboard machines into.
- One Private Endpoint per VNet that hosts agents.
- Private DNS zones for `*.guestconfiguration.azure.com`,
  `*.his.arc.azure.com`, `*.dp.kubernetesconfiguration.azure.com`,
  `*.servicebus.windows.net`, `*.guestnotificationservice.azure.com`,
  `agentserviceapi.guestconfiguration.azure.com`. The portal can
  auto-create these via `arcserverprivatelinkonboarding`.
- ExpressRoute / VPN between the on-prem network and the VNet.

### Onboarding snippet

```bash
azcmagent connect \
    --resource-group "$RG" \
    --tenant-id "$TENANT" \
    --location "$REGION" \
    --subscription-id "$SUB" \
    --private-link-scope "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.HybridCompute/privateLinkScopes/<pls>"
```

### Common gotchas

- DNS must resolve the private addresses on the machine. A split-horizon
  DNS misconfiguration is the #1 cause of "agent installed but never
  connects" with Private Link.
- A machine onboarded **with** Private Link cannot be moved to public
  endpoint without `azcmagent disconnect` and re-onboard.

## Arc Gateway

A `Microsoft.HybridCompute/gateways` resource that acts as a controlled
egress point for many Arc machines. Reduces the number of FQDNs each
machine needs to reach to **one** gateway FQDN.

### When to choose

- The user wants to simplify firewall allowlists (one FQDN, not 20).
- The user wants central audit of all Arc agent traffic.
- The user is also onboarding multi-cloud (AWS / GCP) machines and wants
  one egress for all of them.

### Onboarding snippet

```bash
azcmagent connect \
    --resource-group "$RG" \
    --tenant-id "$TENANT" \
    --location "$REGION" \
    --subscription-id "$SUB" \
    --gateway-id "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.HybridCompute/gateways/<gateway>"
```

### Combinable with Private Link

Yes. Arc Gateway can sit in front of a Private Link Scope, so a single
allowlist entry covers both. Set both `--gateway-id` and
`--private-link-scope` on connect.

## Air-gapped / Edge cloud

The portal supports air-gapped operations via the `enableagcaltdownload`
(US Sec / US Nat) and `enablealtdownload` (Edge) feature flags. The
onboarding script substitutes:

- An **alt download URL** for the agent installer (a blob endpoint
  reachable from the air-gapped network).
- An **alt HIS endpoint** (`enablealthisendpoint`) for first-call
  discovery.
- A specified **ARM endpoint** (`enablespecifiedarmendpoint`) for
  Edge / Stack Hub scenarios.
- A custom **endpoints.json** file written under
  `%ProgramData%\AzureConnectedMachineAgent\Config\endpoints.json` (the
  `Save-EndpointsFile` function the portal injects - see
  `OnboardingScriptCloudSpecificBlocks.ts`).

If the user is on Public Cloud, none of this applies.

## Decision matrix

| User's situation | Connectivity | Auth | Extras |
|---|---|---|---|
| Single laptop POC | Public | Interactive token | none |
| 5 servers in a corp datacenter, internet via proxy | Public | Service Principal | proxy URL |
| 100 servers in a private datacenter, ExpressRoute to Azure | Private Link | Service Principal | PLS + DNS zones |
| 500 servers across multiple sites, want one firewall rule | Arc Gateway | Service Principal | Gateway resource |
| Air-gapped facility | Edge / Air-gapped | Service Principal | alt-download URL + alt-HIS endpoint + endpoints.json |

## Source of truth in this repo

The connectivity options the portal exposes are defined in:

- `Client/React/Views/ArcServers/Enums.d.ts` (`ConnectivityMethod`)
- `Client/React/Views/ArcServers/Create/ScriptUx/Utilities/ResolveOnboardingInputs.ts`
- `Client/React/Views/ArcServers/Create/ScriptUx/Utilities/OnboardingScriptCloudSpecificBlocks.ts`
- `extension.config.json` (feature flags: `arcservergateways`,
  `arcserverprivatelinkonboarding`, `enablespecifiedarmendpoint`,
  `enablealtdownload`, `enablealthisendpoint`, `enableagcaltdownload`)
- `featureFlags.md` (per-environment status)
