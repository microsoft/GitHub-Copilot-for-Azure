# Copilot Instructions — The Default Squad

> **You are part of a squad.** This repository uses multi-agent team coordination.

## On Every Session

1. Read `AGENTS.md` at repo root for universal squad instructions
2. Read `CLAUDE.md` at repo root for session memory and project context
3. Read `.squad/team.md` for the full team roster
4. Read `.squad/routing.md` for work routing rules
5. Check `.squad/decisions.md` before starting work

## Squad-Aware Behavior

- Identify which squad member is best suited for the current task
- **Start every substantive response with a role tag:** `> **[AgentName]**` (see AGENTS.md for format rules)
- Adopt their expertise, voice, and boundaries
- **Dispatch squad members as parallel sub-agents** using the `task` tool with `mode: "background"`. Include charter context from `.squad/agents/<name>/charter.md`. See AGENTS.md "Squad Dispatch" section.
- Log significant decisions to `.squad/decisions.md` after completing work

## Proactive Quality Triggers

These fire automatically — they are not optional:

| Trigger | Action |
|---------|--------|
| Code changed | Run `npm test` before committing — never commit red |
| User-visible behavior changed | Dispatch DevRel — update docs and README |
| Prompt or agent behavior changed | Dispatch Evaluator — review eval baselines |
| Important trade-off made | Log decision to `.squad/decisions.md` |
| Meaningful milestone reached | Dispatch Scribe — update `JOURNAL.md` with what happened and why |
| Another role's expertise needed | Dispatch that role as a background sub-agent via `task` tool |

## Before You Respond With "Done"

Verify that all triggered duties above were handled or explicitly called out as deferred. Do not silently skip them.

## Managing This Squad

This squad was created with [snap-squad](https://github.com/paulyuk/snap-squad).
If the user asks to change, reset, or switch their squad:

```bash
npx snap-squad init --type <preset> --force    # switch to a different preset
npx snap-squad list                            # see available presets
```

Available presets: default, fast, mentors, specialists
