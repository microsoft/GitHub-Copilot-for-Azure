from __future__ import annotations

import os

from google.adk import Agent

INSTRUCTIONS = """You are a concise customer-support agent.
For every order-status question, call get_order_status before answering.
Only report facts returned by the tool. If an order is not found, ask the
customer to verify the order ID.
"""

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


def get_order_status(order_id: str) -> dict[str, object]:
    """Look up an order by its order ID.

    Args:
        order_id: The customer-facing order ID.

    Returns:
        The normalized order ID and its status, or a not-found result.
    """
    normalized_id = order_id.strip().upper()
    order = ORDERS.get(normalized_id)
    if not order:
        return {"found": False, "order_id": normalized_id}
    return {"found": True, "order_id": normalized_id, **order}


root_agent = Agent(
    name="order_support",
    description="Answers customer questions about order status.",
    instruction=INSTRUCTIONS,
    model=os.getenv("GOOGLE_MODEL", "gemini-2.5-flash"),
    tools=[get_order_status],
)
