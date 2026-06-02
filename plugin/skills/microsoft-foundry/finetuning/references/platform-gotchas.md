# Platform Gotchas — Top 10

1. **OSS models require `"trainingType": "globalStandard"`** in the request body — undocumented, and all OSS FT jobs fail without it.

2. **Model catalog `fine_tune` flag is wrong for OSS models** — API returns `fine_tune = false` for all OSS models despite being FT-supported. Hardcode the supported list.

3. **Older SDK versions may fail on `/v1/` project endpoints** — `client.files.create()` throws "API version not supported" with older `openai` package versions. Upgrade to `openai>=1.0` and use the `/v1/` project endpoint (preferred). If you must use an older SDK, fall back to REST API with the non-project `/openai/` endpoint.

4. **ARM "Succeeded" doesn't mean deployment is ready** — `provisioningState: Succeeded` but data plane returns `DeploymentNotReady` indefinitely. Delete and recreate the deployment, then wait ~5 minutes.

5. **OSS FT deployments may fail with InternalServerError** — use the correct provider-specific `model.format` (e.g., `"Mistral AI"` not `"OpenAI"`) and try `capacity=100`.

6. **OSS FT inference hits "Failed to load LoRA" intermittently** — deploy with capacity ≥ 100, use 8+ retries with exponential backoff, and wait 2+ minutes after deployment before first call.

7. **ARM REST and `az cognitiveservices` use different format strings for OSS models** — ARM uses provider names (`"Microsoft"`, `"Meta"`), CLI uses `"OpenAI-OSS"` for all OSS. Mixing them produces HTTP 500.

8. **Content safety false positives on entity extraction data** — PII-dense data (medical records, legal docs, resumes) can trigger "Hate/Fairness" blocks at deployment time. Remove problematic document types.

9. **FT deployments at capacity=1 are severely rate-limited (~1 RPM)** — evaluating 10 samples takes ~10 minutes. Use capacity ≥ 100 for eval workloads and exponential backoff.

10. **Wrong resource endpoint is a silent killer** — jobs submitted to the wrong Foundry resource succeed via API but don't appear in the portal. Always verify the endpoint matches your Foundry project.

11. **Training jobs can silently hang in `running` state** — occasionally a job stops emitting events partway through (e.g., after step 60-400) and never reaches a terminal status. The Foundry portal shows ongoing progress that never advances. Workaround: monitor wall-clock time between events; if > 30 min with no new event, cancel with `client.fine_tuning.jobs.cancel(job_id)` and resubmit.

12. **`FW-*` prefixed models use format `"Fireworks"`, not the provider format** — Fireworks-hosted FT models (`FW-Qwen3-14B`, `FW-DeepSeek-V3.1`, `FW-Qwen3.5-9B`, …) deploy with `"format": "Fireworks"` in the ARM REST body, **not** `"Alibaba"`/`"DeepSeek"`/etc. Using the underlying-provider format fails with HTTP 500 and no useful message. Auto-detection in `scripts/deploy_model.py` matches the `FW-` prefix first; keep that rule order.

13. **First inference on a fresh OSS deployment may return `None`** — even after `ProvisioningState: Succeeded`, the first `chat.completions.create()` call to a new OSS deployment occasionally returns `response.choices[0].message.content == None` (model is warming up the LoRA weights). Retry 1–2 times with a 30s backoff. Observed on `gpt-oss-20b-11`; Qwen3-32B has been seen to respond cleanly on the first call.
