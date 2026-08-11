from __future__ import annotations

import os
import sys
from pathlib import Path

from google.adk import Agent
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from mcp import StdioServerParameters

INSTRUCTIONS = """You are a concise customer-support agent.
For every order-status question, call get_order_status before answering.
Only report facts returned by the tool. If an order is not found, ask the
customer to verify the order ID.
"""

MCP_SERVER_PATH = Path(__file__).resolve().parents[1] / "mcp_server.py"

order_tools = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command=sys.executable,
            args=[str(MCP_SERVER_PATH)],
            cwd=str(MCP_SERVER_PATH.parent),
        ),
        timeout=10,
    ),
    tool_filter=["get_order_status"],
)


root_agent = Agent(
    name="order_support",
    description="Answers customer questions about order status.",
    instruction=INSTRUCTIONS,
    model=os.getenv("GOOGLE_MODEL", "gemini-2.5-flash"),
    tools=[order_tools],
)
