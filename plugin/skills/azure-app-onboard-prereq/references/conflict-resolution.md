# Stack Detection Conflicts

Prereq owns detected-vs-stated stack conflict resolution. On direct entry, there may be no prior `intent` — prereq handles conflicts autonomously.

| Situation | Rule |
|-----------|------|
| User explicitly states stack after scan | **User wins.** Write user's choice to `context.json`, mark scan result as override in findings. |
| User hasn't stated stack, scan detects one | **Scan wins.** Confirm with user: *"I detected Python — is that right?"* |
| Scan detects multiple stacks (monorepo) | **Show all, ask user to confirm.** *"I found a Python backend and React frontend — should I evaluate both?"* See [component-mapping.md](component-mapping.md) for monorepo handling. |
| Scan detects nothing, user states stack | **User wins.** Enter [zero-code path](zero-code-path.md), scaffold from scratch. |
| Scan and user agree | No conflict. Proceed. |
