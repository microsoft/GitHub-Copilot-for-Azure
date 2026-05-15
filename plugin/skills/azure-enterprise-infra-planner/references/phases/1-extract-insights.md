# Phase 1: Extract Insights

> The goal of this phase is to extract insights from the user's existing Azure environment which will be used to guide the planning process.

1. Ask the user whether they want to get subscription or tenant level insights (default option is subscription level using their **current subscription** as specified by az cli).
2. Call `insights_get` tool directly and save the final insights to `<project-root>/.azure/insights.json` exactly as returned by the tool.
