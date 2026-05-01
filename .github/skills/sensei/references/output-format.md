# Review Output Format

Structure every review as:

1. `## Code Review — PR #<number>: <title>`
2. `### ✅ What Looks Good` — 3-5 genuine positives
3. Severity sections (🔴 Critical → 🟠 High → 🟡 Medium → 🟢 Low) — omit empty ones
4. Each finding: numbered title, **File(s)** with lines, **Issue** with evidence, **Suggested Fix**
5. `### Summary` — table of Priority × Count
6. `**Overall Assessment:**` — Approve / Comment / Request Changes

Number findings sequentially across all severities.
