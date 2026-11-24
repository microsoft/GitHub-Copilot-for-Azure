# Azure MCP capability boundary

This adapter targets merged Azure MCP Monitor commands, not the original
standalone server. Load `trace-investigation-contract` and its transport/capability
reference before executing a workflow. At an unavailable
required step, report the missing capability and the result that cannot be claimed.
Never approximate that step or invent a tool/parameter. Supported query,
selection-versus-remainder top attributes and ordinary critical path remain usable.

# Triage an app

Own detection, observation-scoped ranking and first evidence dispatch; inherit shared rules.

## 1. Enter and load the common contract

- Broad app symptoms start here; already-scoped questions may enter the matching specialist directly.
- Before the first trace query, load the plugin skill
  `trace-investigation-contract` by that exact
  native name; reuse its loaded state throughout the investigation.
  Apply that contract's provider, scope, query, recovery, accounting, continuation and answer rules.
- Resolve the supplied AMW to its workspace/group identity through the shared contract.
  When time is absent, freeze the last 6h and disclose it.
- `maxFindings` is a nonnegative integer, default 3; zero means inventory only.

## 2. Plan this bounded stage

- For positive maxFindings, triage's local fresh-call ceiling is `16 + 4 * (maxFindings - 1)`;
  the default is 24. This is a stage allowance, NOT a whole-chain stop or caller cap.
  Without a caller cap, the chain remains unspecified; a useful receiver may still execute.
- Count fresh setup/validation/submissions, including new sampling/refinement queries,
  against its allowance. Resumes still count as actual attempts in shared accounting.
- Reserve two evidence calls per retained candidate: one example trace query and one analytic.
  Spend the remainder on bounded observations/refinement and local tails, not exhaustive scans.
- Stage order: inventory/errors → local reduction → selected tails → ranking →
  example trace/analytic per winner → receiving specialist → consolidated answer.
- Metric-first entry is unavailable: merged Monitor has no PromQL query/range or
  label-discovery commands. Do not substitute resource metrics or claim trace-derived KPIs.
  Report this prerequisite; proceed only with an explicitly trace-only observation scope.

## 3. Observe bounded scopes and error indicators

- Apply shared sampling/refinement rules to P; capture bounded records with `include-spans=false`,
  `max-results=1000`, projecting trace_id, duration_nano, error_rate and needed scope/start fields.
- Discover candidate Q from observed service/span operation/path or applicable attributes;
  use bounded projected span vocabulary if needed. Root labels are optional grouping, not forced P.
- For broad app requests, build a distinct service/operation/path shortlist before deep drilling.
  If one sample is dominated by one scope, use several bounded observed-scope/attribute slices;
  disclose unexamined scopes and differing selection, not representative cross-slice estimates.
- Freeze each captured observation set. Exact percentile cohorts require the absent
  latency-cohort helper; report cutoffs/IDs/ranking based on those cohorts unavailable.
  Do not sort capped rows to reconstruct the helper output or mix redrawn samples.
- `error_rate > 0` is a trace-record indicator, not service-span error or customer failure.
  Keep trace membership, matching-span measurements and their units distinct.
- SDK 404s, polling, guardrails and slow background work remain indicator candidates,
  not automatically confirmed app incidents.
- At maxFindings=0, skip tails, evidence and continuation; proceed to stage 7.

## 4. Count observed tails, then rank

- Measure supported candidate scopes' error/delay signals in their declared observation sets,
  retaining P and discovered Q; volume alone does not choose the first investigation.
- Percentile baseline/slow/outlier ranking is unavailable without the exact cohort
  helper. A caller-supplied SLO can be measured on the frozen scope with explicit
  integer-nanosecond bounds; it is not a derived percentile cutoff.
- Score observed indicators = affected count × weight, using comparable units/selection;
  differing biased slices support qualified proxies, not comparable probability/account impact.
  error 3, SLO-threshold 2. Percentile-tail scores are unavailable without the helper.
  Verify affected ≤ selected total before percentages.
- For overlapping symptoms of one scope, take MAX(error score, slow score), never sum.
  Sort descending supported impact proxy, errors win ties, then scope label; retain up to
  maxFindings distinct supported candidates, not several symptoms of one arbitrary path.
- Finish this score table BEFORE deep evidence. Investigate each selected scope's winning outcome;
  preserve other symptoms separately. Refine an unresolved scope with shared bounded Q rules.
- Ranking is among observed candidates, not account top issues. Record unmeasured scope/tails.
  A selected-service drill does not complete broad app prioritization without this shortlist.
  Without an SLO or supplied complete cohorts, percentile tails remain unmeasured.

## 5. Fetch example traces and choose one analytic

- Choose one example trace from retained observations under P + Q + its measured winning outcome.
  Derived percentile IDs are unavailable; use only independently supplied complete cohorts,
  never locally reconstructed capped percentile IDs.
  Do not add an Error-span filter to improve the story or export IDs to reconfirm an aggregate.
- Independent statistics/attributes/CPA comparison is unavailable. Ordinary CPA is
  usable on supplied complete nonempty ID sets of at most 1000; never label separate calls
  as a paired comparison. Query-defined CPA and compact/structured switches are absent.
- For a separately scoped selection-versus-complement question, use
  `monitor traces query analyze-top-attributes` with overall-query=P+Q,
  explicit contained overall/selection windows and `top-n=3`;
  `selection-field="error_rate"`, `selection-op=">"`, `selection-value="0"`.
  Skip empty cohorts. Its values/counts are span associations, not trace totals or causal proof.
- Keep measured signature and analytic `error_rate > 0` selection separate.
  The adapter replaces the source's success indicator with the discovered error indicator,
  not proof of signature equivalence or business failure.
- CPA: distinct selected IDs under compatible operation/measurement cohorts, P/Q/outcome/window;
  `aggregate-by=["span.service.name","span.name"]`. Stratify incompatible mixtures, not root-only P.
  Verify input completeness and nonempty IDs before CPA; incomplete cohorts cannot
  be passed as complete populations, and cohorts over 1000 IDs exceed the CPA limit.
  Outlier-versus-remaining-slow comparison remains unavailable.
  Report returned bucket percentiles, not raw maxima, exclusive time or exact CP shares.
- Use the discovered query, top-attributes and ordinary CPA commands with
  the same resolved workspace/group. Their exposed schemas are authoritative.

## 6. Dispatch the unresolved winning symptom

- Follow the common contract's same-investigation load AND execution, not a suggested handoff:
  `trace-latency-root-cause` for delay; `trace-error-blast-radius` for failures; `trace-what-changed` for changes;
  `trace-agent-behavior-regression` for token/tool behavior.
- Add triage's shortlist, score/weight, selected Q, winning outcome, uncounted tails and exact
  tailPredicate to shared internal continuation state; retain exemplarIds and cohort distinctions.
- Set nextSkill/whyNext/hypothesis and one nextQuery/nextCheck that discriminates the driver,
  using the full finding scope and the hypothesis's actual observed fields.
- Continue supported discriminating refinement/drill/receiver work to the shared clear-answer
  endpoint; sample caps are not an early-stop excuse and do not justify exhaustive inventory.

## 7. Consolidate and verify the findings

- Consolidate triage and receiver results using the common answer format.
- Classify measured indicators separately from confirmed issues; sparse evidence can yield
  zero confirmed issues. Never fill maxFindings with expected behavior.
- Verify score order, exact cutoffs, selected-scope coverage, winning-outcome evidence and
  compatible CPA cohorts. Explain confirmed issue/cause/impact or the exact candidate boundary;
  include receiver results and sampled/unmeasured scope, not tool receipts as the bottom line.
