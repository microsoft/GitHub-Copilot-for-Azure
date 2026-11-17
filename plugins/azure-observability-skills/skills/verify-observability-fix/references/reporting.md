# 4. Report narrowly

Report retained scope, actual change, windows, thresholds, required/optional
checks, measurable original/post comparisons, sample/span/freshness coverage,
and source/query references from the sanitized input. Return one of
**VERIFIED_RECOVERED**, **NOT_RECOVERED**, or **INCONCLUSIVE**, with concrete gaps
and next evidence needed. Invalid helper input instead produces a sanitized
error/nonzero exit; correct it explicitly, never call it recovered.

Separate instructions loaded, local operations actually executed, tools-only
fallback, supporting deployment/evaluation results, and unexecuted collection.
Say “supplied evidence meets the agreed recovery gates,” not “the change caused
recovery.” No confidence scores, inferred root cause, universal correlation,
automatic remediation, live-access claims, or client compatibility certification.
Do not persist results or modify parent mapping/documentation as part of this flow.
