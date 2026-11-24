from typing import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class Ticket(TypedDict):
    message: str
    queue: str


def classify(ticket: Ticket) -> dict[str, str]:
    priority = "urgent" if ticket["message"].startswith("P1:") else "standard"
    return {"queue": priority}


builder = StateGraph(Ticket)
builder.add_node("classify", classify)
builder.add_edge(START, "classify")
builder.add_edge("classify", END)
graph = builder.compile(checkpointer=InMemorySaver())
