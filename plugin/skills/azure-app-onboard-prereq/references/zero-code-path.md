# Zero-Code Path

When the workspace is empty (no project files, no Dockerfile), prereq scaffolds a starter project before evaluating.

## Flow

1. Ask what they want to build: *"What kind of app are you building?"* (e.g., "a todo app", "REST API"). Users know what they want, not what stack to use.
2. Recommend a stack based on the answer: *"For a REST API with a database, I'd suggest Node.js with a framework like Express or Fastify. Sound good?"* User can accept or override.
3. ⛔ **Confirm before scaffolding** via `ask_user`.
4. Scaffold minimal starter project: entry point, package manifest, README, health endpoint.
5. **Validate generated code** — ⛔ **When the agent has WRITTEN code from scratch, offer to run build validation before evaluation.** The generated code has never been tested. Present: **"I've scaffolded your app. Want me to install dependencies, build, and run tests? (Yes / Skip)"**
   - If **Yes**: run `npm install` → `npm run build` → `npm test` (or stack equivalent). If any step fails, fix the issue and retry (max 2 attempts). This is allowed because the agent WROTE the code — it's not an existing repo.
   - If **Skip**: proceed to Step 6. The deploy phase will handle builds via Oryx/ACR.
   - ⛔ **This gate applies ONLY to code the agent generated from scratch.** It does NOT apply to existing repos — those follow the deploy-as-is principle with the ABSOLUTE PROHIBITION on `npm install` during prereq.
6. Run Phase 1 evaluation (from Step 2) on the scaffolded code.
7. Proceed to Phase 2.

## Rules

- Max 3 interactions before scaffolding begins.
- Scaffold dynamically based on app description — no hardcoded templates. Read the stack ecosystem's conventions (e.g., `npm init` patterns for Node, `dotnet new webapi` patterns for .NET).
- If user gives no app description after 2 attempts: *"I can't evaluate an empty workspace without knowing what you want to build. Try: 'I want to build a REST API' or 'Help me scaffold a Node.js API.'"*
