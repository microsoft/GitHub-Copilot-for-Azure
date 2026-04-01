# Routing Rules — The Default Squad

## Work Type → Agent

| Work Type | Agent | Examples |
|-----------|-------|---------|
| architecture | Architect | System design, scope, trade-offs, code review |
| implementation | Coder | Feature code, CLI, runtime, file operations |
| testing | Tester | Tests, quality gates, edge cases, CI/CD |
| documentation | DevRel | README, docs, messaging, onboarding, examples |
| prompts | Prompter | Agent charters, system prompts, manifest design |
| git | GitOps | Git workflow, pushes, PRs, releases, GitHub auth, CI/CD |
| evals | Evaluator | Eval design, baselines, agent-as-judge, quality scoring |
| research | Researcher | Ecosystem research, grounding content review, upstream tracking, weekly opportunity check-ins |
| history | Scribe | Build journal, decision history, evolution narrative, prompt curation, markdown review |

## Routing Principles

1. **Eager by default** — dispatch agents who could usefully start work in parallel.
2. **"Spawn" means dispatch a sub-agent.** Use the `task` tool with `mode: "background"` to launch squad members as parallel sub-agents. Include the agent's charter from `.squad/agents/<name>/charter.md` in the dispatch prompt.
3. **Scribe always runs** after substantial work, dispatched in background. Never blocks.
4. **Quick facts → lead agent answers directly.** Don't dispatch for trivial questions.
5. **Two agents could handle it** → pick the one whose domain is the primary concern.
6. **Anticipate downstream.** Feature being built? Dispatch tester simultaneously as a background sub-agent.

## Automatic Secondary Routing

These triggers fire every session, regardless of user request:

| When this happens... | Also activate... |
|---------------------|-----------------|
| Implementation work | Testing review (Tester/equivalent) |
| User-visible behavior changes | Documentation update (DevRel/equivalent) |
| Prompt or agent changes | Eval baseline check (Evaluator/equivalent) |
| Significant trade-off or decision | Decision logging (any agent) |
| Meaningful milestone reached | Journal update (Scribe/equivalent) |

## Completion Routing Check

Before finishing, ask: **"Which squad roles should have touched this work but haven't?"**
Resolve those gaps or explicitly report them before ending the session.
