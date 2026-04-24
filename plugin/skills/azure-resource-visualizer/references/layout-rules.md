# Draw.io Layout Rules

## 1. Screen-fit target

Diagrams must fit within a **1900×1000 viewport** (full-HD landscape) with no horizontal scrolling on the Architecture Overview page.

## 2. Layout Patterns

**Left-to-right flow** (preferred for standard 3-tier web architectures):
Use when the architecture has a dominant traffic path — internet → ingress → application → data.

Column order:
1. Internet-facing resources outside VNet (Public IP, public DNS zone)
2. VNet with stacked subnets (ingress top, integration middle, Private Link bottom)
3. Application tier outside VNet (App Service Plan above, App Service below)
4. Supporting services at right (Key Vault top, App Insights middle)

Canvas: `pageWidth="1400" pageHeight="780"` for ≤15 resources.

**2×2 zone grid** (only when all four zones are meaningfully populated):

**Do NOT apply the zone grid to standard 3-tier web architectures** — zone grids create long cross-zone edges in linear architectures, breaking semantic proximity and producing unreadable diagonal lines.

| Position | Zone | Typical contents |
|----------|------|------------------|
| Top-left | Ingress | Public IP, App Gateway, WAF policy, DNS zone, Front Door |
| Top-right | Application | App Services, ASPs, Container Apps, Function Apps |
| Bottom-left | Data | SQL, Key Vault, Storage accounts, App Config, Cosmos DB |
| Bottom-right | Operations | Bastion hosts, jump-box VMs, management VMs |

Reference geometry: RG container `x=20 y=20 w=1820 h=930`; Row 1 zones (y=80, h=380): Ingress `x=30 w=430` | Application `x=480 w=1310`; Row 2 zones (y=480, h=420): Data `x=30 w=960` | Operations `x=1010 w=780`.

**Flat environment** (no networking tier): skip zone containers; arrange directly inside RG — ingress/security left, application middle, data right.

## 3. Hub-and-spoke (resource with ≥5 connections)

Place the hub at centre and distribute peers in distinct spatial directions:

| Direction | Typical candidate |
|-----------|-------------------|
| ↑ Up | Resource the hub depends on (e.g. App Service Plan) |
| ← Left | Security resources (Key Vault, identity) |
| → Right | Data / storage (Storage Account, database) |
| ↓ Down | Identity resources (Managed Identity, RBAC targets) |
| ↙ Down-left | Outbound integrations (Communication Services, Event Hub) |

No two peers should share the same compass direction from the hub.

## 4. Semantic Proximity Rules

Every edge should connect to its nearest spatial neighbour:

- **Public DNS Zone** → ingress column (leftmost), next to the Public IP. Never place in a Data zone.
- **Key Vault** → adjacent to its primary consumer. Waypoint long edges through column gaps.
- **Private DNS Zones** → inside or adjacent to the Private Link subnet they serve.
- **App Service Plan** → immediately above the App Service it hosts, same x-coordinate.
- **SQL resources** → below or beside the Private Link subnet containing their Private Endpoint.

## 5. Network Topology Page Layout

**Grid layout (3 columns × N rows):** Arrange subnets in a compact grid grouped by function, not a flat horizontal row.

| Row | Typical subnets |
|-----|----------------|
| Row 1 | External / ingress subnets |
| Row 2 | Internal / integration subnets |
| Row 3 | Data subnets |
| Row 4 | Support subnets |

**Key rules:**
- Pair related subnets vertically (External above Internal for same service)
- Size subnets to content: 1–3 icons ≈ 450×230px (not 560×380px)
- Add per-subnet route table icons (36px, fontSize=9) instead of a central route table with radiating edges
- Legend: horizontal bar below the VNet container, ~full-width × 170px; not a tall side panel
- Page dimensions: `pageWidth="1800" pageHeight="1600"` for 12 subnets; never exceed `pageWidth="1900"`

## 6. Anti-patterns to Avoid

1. Using the 2×2 zone grid for standard 3-tier web apps — causes backward edges and long diagonals.
2. Placing the public DNS Zone on the far right — it belongs next to the Public IP.
3. Routing App Gateway → Key Vault as a bottom-of-canvas diagonal — place Key Vault near App Service.
4. Over-sizing VNet containers to fill a zone quadrant — always size to content.
5. Placing ASPs, Managed Identities, or WAF Policies in a row at VNet bottom — absorb into parent subnet.
6. Using a central route table icon with radiating edges — add per-subnet route table icons instead.
7. Building network pages as wide flat layouts (2 rows × 6+ columns) — use 3-column grids.
8. Placing a tall legend panel on the right side, pushing width beyond the viewport.
9. **Stacking nodes that share many connections in a single column** — this forces every edge to route through the same corridor, creating overlapping lines. Spread connection-heavy resources across at least two columns or rows.
10. **Using long edge labels (>30 characters)** — long labels overlap adjacent edges and icons. Keep labels ≤30 characters; move extra detail to a legend.
