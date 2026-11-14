# Assessment acceptance scenarios

Run separately in VS Code and Copilot CLI. Record host/version, actual skill
loading, operation/query inputs, outputs, and report fidelity. Static package
checks do not validate model behavior, KQL execution, or agent integration.

| Scenario | Expected behavior |
|---|---|
| Explicit invocation without cloud approval | Loads instructions; establishes prerequisites without querying |
| Natural-language health request | Selects appropriate skill if supported; does not assume onboarding was done |
| Ordinary health or onboarding handoff | Loads stable assess-observability-health and its integrated resources, not a separate contributed engine |
| Explicit external specialist request | Honors an eligible available permitted specialist after checking complete instructions and actual access; no recursive health selection |
| Supplied package readable but not host-discovered | Distinguishes instruction-guided use from verified skill activation; no automatic copy or installation |
| Optional specialist unavailable | Names the concrete blocker; no claim that the external skill executed |
| Optional external service unavailable | Integrated health remains independently usable; no service conversation is created |
| Specialist requests persistence or broader scope | Existing no-save and query-scope restrictions remain binding; approval precedes the additional operation |
| Execution attribution | Names instructions loaded, actual MCP/tool operations, reused evidence, skipped steps and fallback reason; package inspection/offline tests are not live execution |
| No Python | Existing query tools remain usable; no helper validation or persistence claim |
| Reversed request/dependency result order | Numbers remain attached to explicit signal/source labels |
| Stale telemetry, idle demo | Current INCONCLUSIVE; historical observations separate; no generated traffic |
| Fresh parent success, failed child | Reports supported child degradation, not blanket healthy |
| Denied core source | Explicit coverage gap; no healthy verdict or identity switch |
| Partial/truncated results | Supported observations qualified; completeness gap preserved |
| Sampled telemetry | Stored records, represented events and logical calls not conflated |
| Missing SLO/baseline | Measurements reported; no invented latency threshold or recovery claim |
| Missing Foundry association | No guessed project/agent attribution |
| No evaluations | Operational scope only; no answer-quality or safety certification |
| Duplicate model layers | No unsupported logical-call or token-total summation |
| Optional external service unavailable | Public assessment does not attempt service conversation creation |
| Selected finding | Scope/window/evidence/limitations carried forward without fabricating a causal conclusion |

Use synthetic evidence for semantic corner cases and clearly label it. Test
live access separately under explicit bounded-read approval.

Suggested fresh-session prompt:

> Use assess-observability-health. First establish the available tools and what
> scope/evidence you would need for a web/API or Foundry-agent health assessment.
> Do not query Azure, install anything, edit files, or save data.

For a live task, provide confirmed target/source, the UTC window, freshness and
activity expectations, core surfaces and applicable criteria. Do not use a
single demo environment to certify all workloads.
