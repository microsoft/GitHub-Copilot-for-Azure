from __future__ import annotations

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("order-support")

ORDERS = {
    "A100": {
        "status": "shipped",
        "tracking_number": "ZX-42",
        "estimated_delivery": "2026-07-24",
    },
    "B200": {
        "status": "processing",
        "estimated_ship_date": "2026-07-23",
    },
}


@mcp.tool()
def get_order_status(order_id: str) -> dict[str, object]:
    """Look up an order by its customer-facing order ID."""
    normalized_id = order_id.strip().upper()
    order = ORDERS.get(normalized_id)
    if not order:
        return {"found": False, "order_id": normalized_id}
    return {"found": True, "order_id": normalized_id, **order}


if __name__ == "__main__":
    mcp.run(transport="stdio")
