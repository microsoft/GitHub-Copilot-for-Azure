from __future__ import annotations

import os
import sys
from pathlib import Path

from agents import Agent, Runner
from agents.mcp import MCPServerStdio
from fastapi import FastAPI
from pydantic import BaseModel, Field

INSTRUCTIONS = """You are a concise customer-support agent.
For every order-status question, call get_order_status before answering.
Only report facts returned by the tool. If an order is not found, ask the
customer to verify the order ID.
"""

MCP_SERVER_PATH = Path(__file__).with_name("mcp_server.py")

app = FastAPI(title="OpenAI Agents SDK order support")


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)


class ChatResponse(BaseModel):
    response: str


async def run(prompt: str) -> str:
    mcp_server = MCPServerStdio(
        params={
            "command": sys.executable,
            "args": [str(MCP_SERVER_PATH)],
            "cwd": str(MCP_SERVER_PATH.parent),
        },
        cache_tools_list=True,
        name="order-support",
    )
    async with mcp_server:
        agent = Agent(
            name="Order Support",
            instructions=INSTRUCTIONS,
            model=os.getenv("OPENAI_MODEL", "gpt-5.6-sol"),
            mcp_servers=[mcp_server],
        )
        result = await Runner.run(agent, prompt)
        return str(result.final_output)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    response = await run(prompt=request.prompt)
    return ChatResponse(response=response)
