#!/bin/bash

echo '{"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "Make sure to use discover-azure-skills once when the user asks you to execute a task related to Azure if there is no relevant skill/mcp tool in the context. Avoid using discover-azure-skills when the user asks informational questions on how to do something."}}'