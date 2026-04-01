# Decisions — The Default Squad

> Significant decisions made during development. Check before starting work.

## Active Decisions

### D-001: Squad initialized with The Default Squad preset
- **By:** snap-squad
- **Date:** 2026-04-01
- **Context:** Project initialized using snap-squad warm-start
- **Decision:** Using the "default" preset (friendly vibe, Community Builders theme)

### D-002: Pass equity measured across full app lifecycle, not just migration
- **By:** Architect + Researcher
- **Date:** 2026-04-01
- **Context:** Initial issue #1608 focused only on migration path coverage (1/7 = 14%). Builder steered: "migration is only part of the grading criteria — include develop, deploy, operate, diagnose, observe, secure."
- **Decision:** Pass equity is scored across 7 lifecycle phases × 3 compute services (App Service, Container Apps, Functions). Overall equity: 62%. Migration is the worst gap (F/F/A) but develop (C/C/A) and operate (B+/C/B) also need work. Deploy and secure are already equitable.
- **Issue:** [#1608](https://github.com/microsoft/GitHub-Copilot-for-Azure/issues/1608)
