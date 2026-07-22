from __future__ import annotations

import os
import uuid

from agents import Agent, Runner, SQLiteSession, function_tool
from fastapi import FastAPI
from pydantic import BaseModel, Field

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


@function_tool
def get_order_status(order_id: str) -> dict[str, object]:
    """Look up an order by its order ID.

    Args:
        order_id: The customer-facing order ID.
    """
    normalized_id = order_id.strip().upper()
    order = ORDERS.get(normalized_id)
    if not order:
        return {"found": False, "order_id": normalized_id}
    return {"found": True, "order_id": normalized_id, **order}


agent = Agent(
    name="Order Support",
    instructions=INSTRUCTIONS,
    model=os.getenv("OPENAI_MODEL", "gpt-5.6-sol"),
    tools=[get_order_status],
)

app = FastAPI(title="OpenAI Agents SDK order support")


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    session_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        min_length=1,
    )


class ChatResponse(BaseModel):
    response: str
    session_id: str


async def run(prompt: str, session_id: str) -> str:
    database = os.getenv("OPENAI_SESSION_DB", "sessions.sqlite")
    session = SQLiteSession(session_id, database)
    try:
        result = await Runner.run(agent, prompt, session=session)
        return str(result.final_output)
    finally:
        session.close()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    response = await run(request.prompt, request.session_id)
    return ChatResponse(response=response, session_id=request.session_id)
