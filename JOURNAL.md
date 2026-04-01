# JOURNAL.md — Build Story

> How this project was built, the steering moments that shaped it, and why things are the way they are.
> Maintained by **Scribe** (Historian / Build Journalist). Update after milestones.

---

## 2026-04-01 — Project Bootstrapped

**Squad:** The Default Squad · **Vibe:** friendly · **Theme:** Community Builders

### The Team

Architect, Coder, Tester, DevRel, Prompter, GitOps, Evaluator, Researcher, Scribe

### What Happened

Project initialized with the **The Default Squad** squad preset via `npx snap-squad init`. The full `.squad/` directory, hook chain (AGENTS.md, CLAUDE.md, copilot-instructions.md), and this journal were generated automatically.

### Steering Moment

The builder chose **default** — default generalist squad — reliable, well-rounded, good for any project. This shapes everything that follows: who reviews code, how decisions get made, what gets tested first.

### What's Next

- [x] First real feature or task
- [ ] Builder configures project context in `.squad/team.md`
- [x] First decision logged to `.squad/decisions.md`

---

## 2026-04-01 — Pass Equity Assessment (Issue #1608)

**Squad:** Researcher + Architect + Evaluator · **Branch:** `pass-equity`

### What Happened

Full-squad research sprint to assess **pass equity** across Azure compute skills. Three researcher agents ran in parallel auditing: (1) MCP tools & references per service, (2) integration test coverage per lifecycle phase, (3) skill trigger coverage and lifecycle mapping.

### Key Findings

| Phase | App Service | Container Apps | Functions | Equity |
|---|---|---|---|---|
| Develop | C | C | A | 🔴 |
| Deploy | A | A | A | 🟢 |
| Operate | B+ | C | B | 🟡 |
| Diagnose | B | B+ | B | 🟢 |
| Migrate | F | F | A | 🔴 |
| Observe | A- | B | B | 🟡 |
| Secure | A | A | A | 🟢 |

**Overall pass equity: 62%.** Functions gets A-, App Service gets B-, Container Apps gets C+.

### Steering Moment

Builder redirected from migration-only analysis → full lifecycle assessment: *"migration is only part of the grading criteria... include develop, deploy, operate, diagnose."* This expanded scope from 1 dimension to 7 and changed the issue from "add 6 migration paths" to "close equity gaps across the entire developer experience."

### Prior Art

Recovered grading from session `8fc96f69` (March 25): original B+/B+/C comparison focused on MCP tool counts. This assessment goes deeper — lifecycle phases, integration test counts, reference doc coverage, and competitive migration landscape.

### What's Next

- [ ] Phase 1: Close critical gaps (migrate + develop)
- [ ] Phase 2: Close medium gaps (operate + observe)
- [ ] Phase 3: Test equity (integration tests per service × phase)
- [ ] Phase 4: Eval framework (eval.yaml + CI metrics)

---

## 2026-04-01 — 11 PR Proposals Filed (Issue #1608 Updated)

**Squad:** Researcher + Architect + Evaluator · **Branch:** `pass-equity`

### What Happened

Expanded issue #1608 from initial migration-only focus to **11 concrete PR proposals** covering all 11 cells below grade A. Each proposal specifies deliverables, key scenarios (grounded in Azure Learn docs), and is structured to learn from the highest-scoring service and adapt for the target service.

### Steering Moment

Builder steered: *"I want a proposed PR for each equity gap... leverage the highest scoring service to learn from and extrapolate... be clear this is just a starting assessment and proposal."* This shifted from analysis to actionable work items, with clear ownership paths for domain experts.

### PR Summary Table

| PR | Gap | Priority |
|---|---|---|
| PR-1 | App Service Develop C→A | P1 |
| PR-2 | Container Apps Develop C→A | P1 |
| PR-3 | Container Apps Operate C→A | P2 |
| PR-4 | Functions Operate B→A | P3 |
| PR-5 | App Service Operate B+→A | P3 |
| PR-6 | App Service Diagnose B→A | P2 |
| PR-7 | Functions Diagnose B→A | P2 |
| PR-8 | App Service Migrate F→A | P0 |
| PR-9 | Container Apps Migrate F→A | P0 |
| PR-10 | Container Apps Observe B→A | P3 |
| PR-11 | Functions Observe B→A | P3 |

### What's Next

- [ ] Domain expert review of PR proposals (App Service, Container Apps, Functions teams)
- [ ] Begin P0 work: migration PRs (PR-8, PR-9)
- [ ] Begin P1 work: develop template PRs (PR-1, PR-2)

---

## How to Use This Journal

> *Scribe's guide for the builder and future contributors.*

This isn't a changelog. It's the **story of how the project was built** — the decisions, the pivots, the moments where the builder steered the squad in a new direction.

### What to capture

| Entry Type | When | Example |
|-----------|------|---------|
| **Steering Moment** | Builder redirects the squad | "Switched from REST to GraphQL after seeing the query complexity" |
| **Key Decision** | Trade-off was made | "Chose SQLite over Postgres — this is a CLI tool, not a service" |
| **Evolution** | Architecture shifted | "Split monolith into 3 modules after hitting circular deps" |
| **Milestone** | Something shipped | "v0.1.0 published to npm — first public release" |
| **Lesson Learned** | Something surprised you | "Vitest runs 10x faster than Jest for this project — switching permanently" |

### Template for new entries

```markdown
## YYYY-MM-DD — Title

### What Happened

(What was built, changed, or decided)

### Why

(The reasoning — what alternatives existed, what trade-offs were made)

### Steering Moment

(How the builder directed the work — what prompt, feedback, or redirection shaped the outcome)

### Impact

(What this changes going forward)
```

### Rules

1. **Write for future-you.** Six months from now, this journal explains *why* the code looks the way it does.
2. **Capture the steering, not the typing.** The git log shows what changed. The journal shows *why it changed*.
3. **Be honest about pivots.** The best journals include "we tried X, it didn't work, here's why we switched to Y."
4. **Update after milestones, not after every commit.** Quality over quantity.

---

*The code shows what was built. The journal shows why.*
