# Foundry context-reduction adaptation

The entry remains compact and routes only the current request. Detailed entry
instructions are retained in conditional `entry--*.md` selections. Five workflows
that exceed the named tokenizer limit retain their original paths as routers:
hosted-agent creation, hosted quickstart, the Foundry tool catalog, deployment,
and preset model-deployment workflow. Each router selects bounded step/branch
references rather than asking Copilot to read every reference.

Seventy-two documents initially partitioned under a conservative byte fallback
were restored after an approved exact tokenizer became available. The remaining
36 selections cover the detailed entry and five oversized workflows. Code
examples remain complete; repeated table headings are rendering scaffolding.
No original workflow path, lifecycle capability, script, dependency or MIT notice
was removed or renamed.

[The extraction map](context-map.json) records every split original path,
selection, retained payload offsets/lengths and hashes. It also records restored
document hashes. Link destinations were rebased or redirected as necessary;
comparison ignoring only Markdown link destinations verified that instruction
and example content survived both extraction and consolidation.
Payload coordinates use BOM-free UTF-8 bytes after LF normalization, so Windows
CRLF and LF formatting produce the same retained-source reconstruction. A
regression test verifies both line endings and BOM handling.
Scoped Git whitespace attributes preserve trailing source paragraph boundaries
in extracted selections; other whitespace checks remain enabled.

Validation uses **tiktoken 0.12.0**, with **cl100k_base** and **o200k_base** measured
separately. Every runtime Markdown file is below 5,000 tokens under each named
encoding; the entry body is below 1,000 under each, including legacy anchor
aliases (frontmatter is measured separately). These are reproducible
named-encoding measurements, not claims about a universal host tokenizer.
The approved test environment and cached encodings are validation tooling only,
not a skill/runtime prerequisite.

`tests/test_foundry_context.py` checks named-tokenizer limits, retained payloads,
restored resources and conditional reachability. Offline reconstruction in tests
does not instruct Copilot to load every selection at runtime. Tests do not prove
host activation, Azure access, external service availability or live recovery.

Every original heading anchor remains available on its split router as an
explicit compatibility alias. Links to extracted sections also resolve their
actual target headings. The anchor check identified eight stale links in restored
quota/harvest references; targeted aliases and the existing quota-request guide
now resolve them. These compatibility additions do not change execution approval.

Selection and execution still require actual host/tool availability, source
schemas, retained scope and applicable approvals. Evidence-only analysis requires
no Azure/Python, installation, authentication, cache, writes or jobs. Full
lifecycle workflows remain separate explicit selections, not automatic next
steps after investigation.
