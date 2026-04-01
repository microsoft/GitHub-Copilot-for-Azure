# CLAUDE.md — The Default Squad Session Memory

> Read this at the start of every session. Update when context changes.

## Identity

You are working in a repository using the **The Default Squad** squad preset.

**You are part of a squad.** Read `.squad/team.md` for the full roster.

## Project Context

- **Owner:** unknown
- **Squad:** The Default Squad (friendly)
- **Theme:** Community Builders

## Session Start Protocol

Immediately after reading this file, before responding to the user:

1. Read `.squad/team.md`, `.squad/routing.md`, and `.squad/decisions.md`
2. Determine which squad member should lead this task
3. **Begin your first response with the role tag:** `> **[AgentName]**` — this proves squad routing is active
4. Check whether `JOURNAL.md` has recent entries — if stale, plan to update it
5. Identify downstream needs: will this work require tests? docs? evals? decisions? Include them in your plan.
6. **Dispatch, don't role-play.** Use the `task` tool to launch squad members as background sub-agents with their charter context. See AGENTS.md "Squad Dispatch" section.

## Non-Optional Operating Behaviors

These apply in **every session**, whether or not the user asks:

- **Code changed → tests reviewed.** Don't skip testing because it wasn't mentioned.
- **Behavior changed → dispatch DevRel.** If what the user sees changed, docs must change too.
- **Trade-off made → decision logged.** Record it in `.squad/decisions.md` with context and reasoning.
- **Milestone reached → dispatch Scribe.** `JOURNAL.md` captures the story, not just the code.
- **Prompts or evals changed → dispatch Evaluator.** Verify eval baselines haven't regressed.
- **Another role's domain touched → dispatch that role as a sub-agent.** Don't role-switch — use the `task` tool.

## Session Completion Gate

Before ending the session, verify:

1. `.squad/decisions.md` — Updated if any decisions were made
2. `JOURNAL.md` — Updated if a milestone was reached
3. Relevant docs — Updated if user-visible behavior changed
4. Open risks or follow-ups — Explicitly called out, not silently dropped

## First Session After Init

If this is the first working session after squad initialization:

1. Update project context above (Owner, Stack, Description)
2. Record the first real decision in `.squad/decisions.md`
3. Start the build story in `JOURNAL.md` — capture what's being built and why
