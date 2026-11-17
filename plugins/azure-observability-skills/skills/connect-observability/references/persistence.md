# 5. Retain only with consent and hand off

Offer to save the minimal mapping, explaining that resource IDs and application
labels are local organizational metadata. Never save transient telemetry,
credentials, identity preferences, or raw prompts in it. The helper requires
`--consent`, an ignored destination, and separate `--replace` for replacement.
If the destination is not ignored, request approval to update ignore rules;
do not bypass this safeguard or force-stage the file.
In tools-only mode, mapping persistence is unavailable. State this limitation,
keep confirmed scope in the current conversation, and do not write mapping JSON
by hand or through an alternative script. Runtime installation requires separate
approval; it is not necessary to continue read-only investigation.

Hand off the confirmed IDs, task, window, per-signal evidence and limitations in
conversation context. Follow [specialist selection](routing.md):
use stable `assess-observability-health` for ordinary health. It integrates
contributed bounded health and public telemetry guidance in one workflow.
Honor explicit eligible external specialist requests with their applicable approvals.
Skills remain independently usable. Load the complete chosen specialist
instructions if supported by the host; otherwise use the documented
instruction-guided path or explain the manual next step. Identify the selected
skill, actual MCP/tool operations, reused evidence and any fallback reason.
Do not claim a specialist was executed merely because it was mentioned or read.
Never require an internal-only service for the external-user path. New specialist
steps retain existing approval boundaries, including persistence and server-side
conversation creation.
