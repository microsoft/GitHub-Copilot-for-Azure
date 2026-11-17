# 4. Validate findings before claiming a cause

Compare every claim with retained observations, timing, counterevidence and
coverage. Correlation is not causation. A completed service run or successful
command does not validate its findings. Repeated attempts with the same timeout
do not establish retry delay, absent backoff, a retry storm, or the cause of the
timeout. Request the actual policy as supplied evidence before choosing a
policy-specific fix. Parent success does not prove that retries or fallback
occurred. Keep such mechanisms explicitly unverified unless observed.
Use the
[confidence attribution rubric](confidence-assessment.md):
direct-path confidence is `caller-assessed`; distinguish any external service
claim from that assessment and retain disagreements. Do not fabricate percentages.
Insufficient material evidence yields **INCONCLUSIVE**, even if some probes pass.
Intentional fixture/design notes cannot raise confidence without runtime evidence.
