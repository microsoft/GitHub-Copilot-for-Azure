# Default Microsoft Foundry Agent Review Rules

Ruleset version: `1.0.0`

Last verified against Microsoft guidance: `2026-08-24`

These are repository-review rules, not certification controls. They cover
Microsoft recommendations and risk-based repository policy derived from those
recommendations. They intentionally exclude schema validity, package layout,
entry-point existence, protocol conformance, dependency restoration, and other
deployability checks. Use `azd ai agent doctor` and deployment tests for those
concerns.

Rule severity is this reviewer's risk rating, not a Microsoft-assigned rating.
Apply a rule only when its applicability statement is satisfied, and do not
fail a recommendation whose applicability or violation is unproven.

## Review profiles

Select one profile before assigning rule statuses:

- `template-baseline`: use for samples, templates, and development baselines
  that explicitly do not claim production readiness. Production-only rules are
  `N/A`; documented adopter responsibilities are not template failures.
- `production-readiness`: use when production use is claimed, planned, or
  explicitly requested. Remotely managed production evidence that cannot be
  established from the repository is `REVIEW`, not `FAIL`.

The profile controls applicability; it never excuses an actual secret,
explicitly unsafe behavior, or a contradiction between a stated security model
and its implementation.

For `Advisory` rules, record `PASS` when the recommendation was considered or
an alternative is reasonable, and `N/A` when the scenario is absent. Do not use
`REVIEW` or `FAIL` unless the rule explicitly defines a failing contradiction,
or an organization rule overrides the default.

## Identity and secrets

### AUTH-001 — Use Microsoft Entra ID for production Foundry workloads

- Severity: `High`
- Applies when: the `production-readiness` profile is selected and a production execution path is present or claimed.
- PASS: production uses Entra-backed identity; API-key examples are isolated and explicitly non-production.
- FAIL: a production Foundry path relies on API-key authentication where Microsoft Entra ID is supported.
- REVIEW: the production authentication method cannot be established.
- Expected state: local development may use developer identity; Azure production uses managed/workload identity and RBAC.
- Rationale: Microsoft recommends Entra ID for production, while API keys remain supported for some rapid-prototyping and isolated-test scenarios. Committed credentials are assessed separately by `SEC-001`.
- Guidance: [Foundry authentication](https://learn.microsoft.com/azure/foundry/concepts/authentication-authorization-foundry#authentication-methods), [Foundry RBAC](https://learn.microsoft.com/azure/foundry/concepts/rbac-foundry)

### AUTH-002 — Use deterministic production credentials

- Severity: `High`
- Applies when: the `production-readiness` profile is selected and an Azure production execution path is present.
- PASS: production uses an explicit workload credential, or a credential chain constrained to the intended managed/workload identity; local development may use developer credentials.
- FAIL: production explicitly uses a developer or interactive credential, or configuration permits a known unintended credential to win.
- REVIEW: production uses an unconstrained credential chain and the deployed identity/environment cannot be verified.
- Expected state: do not fail solely because `DefaultAzureCredential` appears; assess whether its production chain is constrained.
- Rationale: this is Azure Identity SDK guidance, not a Foundry service requirement.
- Guidance: [Credential-chain guidance](https://learn.microsoft.com/azure/developer/python/sdk/authentication/credential-chains), [Passwordless connections](https://learn.microsoft.com/azure/developer/intro/passwordless-overview#introducing-defaultazurecredential)

### SEC-001 — No committed secrets or connection credentials

- Severity: `Critical`
- Applies when: always.
- PASS: tracked content contains no credential material; repository secret scanning or an equivalent tracked-file review is evidenced; expected local secret-bearing files are excluded by effective VCS ignore rules.
- FAIL: tracked source or configuration contains keys, tokens, passwords, client secrets, private-key material, or credential-bearing connection strings.
- REVIEW: a suspicious value cannot be distinguished from a placeholder, or tracked-file coverage cannot be established.
- Expected state: secrets are supplied by managed identity, Key Vault, Foundry connections, or protected CI secret stores.
- Rationale: VCS ignore evidence belongs here. Deployment-package exclusions are a separate deployability concern and do not prove this rule passes.
- Guidance: [Agent development lifecycle](https://learn.microsoft.com/azure/foundry/agents/concepts/development-lifecycle#core-capabilities-for-the-agent-development-lifecycle), [Hosted-agent security](https://learn.microsoft.com/azure/foundry/agents/concepts/hosted-agents#security-and-data-handling), [Microsoft Cloud Security Benchmark IM-8](https://learn.microsoft.com/security/benchmark/azure/mcsb-v2-identity-management#im-8-restrict-the-exposure-of-credentials-and-secrets)

### SEC-002 — Use least-privilege identities and managed secret flows

- Severity: `High`
- Applies when: IaC or configuration defines runtime identity, RBAC, or secret access.
- PASS: the design uses an appropriate workload/platform identity, grants only required roles at the narrowest practical service-supported scope, and uses an approved managed secret mechanism where secrets are necessary.
- FAIL: plaintext production secrets are injected, broad runtime roles lack documented necessity, or required workload authentication is removed without a supported replacement.
- REVIEW: required runtime permissions or secret flows cannot be inferred from repository evidence.
- Expected state: choose scope according to each service's RBAC model; object-level assignment is not automatically safer or recommended. Managed identity is preferred where applicable, but another well-bounded workload identity can be valid.
- Guidance: [Foundry RBAC](https://learn.microsoft.com/azure/foundry/concepts/rbac-foundry), [Managed identity best practices](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/managed-identity-best-practice-recommendations#follow-the-principle-of-least-privilege-when-granting-access), [Protect secrets](https://learn.microsoft.com/azure/security/fundamentals/secrets-best-practices#access-control-and-identity)

## SDK and product recommendations

### SDK-001 — Prefer a current, tested Foundry SDK version

- Severity: `Advisory`
- Applies when: a Foundry SDK dependency is declared.
- PASS: the dependency targets the correct Foundry generation and is tested with the APIs the application actually uses; note newer versions used by current official guidance as upgrade candidates.
- FAIL: never under the default advisory.
- REVIEW: never under the default advisory.
- N/A: no Foundry SDK dependency is declared.
- Advisory behavior: recommend reviewing current samples, release notes, and upgrade compatibility without treating a quickstart package version as a universal runtime minimum.
- Expected state: API-specific minimums apply only when that API is used. For example, the Python SDK minimum documented for programmatic source deployment does not automatically apply to an agent runtime that delegates deployment to `azd`.
- Guidance: [Foundry SDK selection](https://learn.microsoft.com/azure/foundry/how-to/develop/sdk-overview), [Source-deployment prerequisites](https://learn.microsoft.com/azure/foundry/agents/how-to/deploy-hosted-agent-code#prerequisites)

### SDK-002 — Prefer Microsoft Agent Framework where applicable

- Severity: `Advisory`
- Applies when: hosted-agent or multi-agent orchestration is implemented in Python or .NET.
- PASS: Microsoft Agent Framework is used, or an alternative supported framework/custom implementation is accepted for the project's requirements.
- FAIL: never under the default advisory.
- REVIEW: never under the default advisory.
- N/A: Agent Framework is not applicable to the language or architecture.
- Advisory behavior: Microsoft recommends Agent Framework as the Hosted Agent orchestration layer, while Foundry also supports LangGraph, OpenAI Agents SDK, GitHub Copilot SDK, and custom code. An organization rule may require Agent Framework.
- Guidance: [Foundry SDK selection](https://learn.microsoft.com/azure/foundry/how-to/develop/sdk-overview#agent-framework), [Choose your framework](https://learn.microsoft.com/azure/foundry/agents/quickstarts/quickstart-deploy-own-code#choose-your-framework)

## Agent behavior and tools

### AGT-001 — Define agent purpose and tool failure behavior

- Severity: `Medium`
- Applies when: repository evidence stores or references operative agent instructions.
- PASS: instructions define the intended purpose/domain and, when tools are available, explain when to use them and how to respond to tool errors or no results.
- FAIL: never solely because recommended instruction detail is absent; explicit unsafe behavior is assessed by `AGT-002`.
- REVIEW: operative instructions exist but purpose, tool-selection behavior, or failure/no-result behavior is incomplete or cannot be assessed.
- N/A: operative instructions are absent from repository evidence or managed externally.
- Rationale: this is a repository quality policy derived from Microsoft guidance, not a universal platform requirement. Prompt text can describe authorization boundaries but cannot enforce authorization or approval.
- Guidance: [Tool best practices](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-best-practice), [Foundry Agent transparency](https://learn.microsoft.com/azure/foundry/responsible-ai/agents/transparency-note)

### AGT-002 — Do not instruct agents to bypass controls or fabricate success

- Severity: `High`
- Applies when: repository evidence stores or references operative agent instructions.
- PASS: instructions do not authorize fabrication, unrestricted action, control/approval bypass, or treating tool failure as success.
- FAIL: instructions explicitly require or permit fabrication, bypassing controls or approvals, unrestricted consequential action, or representing a failed operation as successful.
- REVIEW: potentially unsafe operative wording is ambiguous.
- N/A: operative instructions are absent from repository evidence or managed externally.
- Guidance: [Tool best practices](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-best-practice), [Foundry Agent transparency](https://learn.microsoft.com/azure/foundry/responsible-ai/agents/transparency-note)

### TOOL-002 — Prefer Foundry Toolbox when centralized governance warrants it

- Severity: `Advisory`
- Applies when: a hosted agent integrates remote tools directly or through Foundry Toolbox.
- PASS: Toolbox is used where centralized credentials, policy, versioning, reuse, or tool search is needed; otherwise the direct integration is a reasonable supported choice.
- FAIL: never under the default advisory.
- REVIEW: never under the default advisory.
- N/A: no applicable remote tool integration exists.
- Advisory behavior: describe Toolbox benefits when relevant without requiring an exception for direct integration. An organization rule may mandate Toolbox.
- Guidance: [Foundry Toolbox](https://learn.microsoft.com/azure/foundry/agents/concepts/toolbox-overview), [Toolbox feature support](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox#feature-support)

### TOOL-003 — Treat remote tool metadata and output as untrusted

- Severity: `High`
- Applies when: tools retrieve external data, metadata, descriptions, annotations, or results.
- PASS: untrusted values are validated or constrained before they drive consequential behavior; retrieved content is not treated as agent instructions.
- FAIL: an untrusted critical value directly drives a consequential action without validation, or remote content is explicitly trusted as higher-priority instruction.
- REVIEW: validation or downstream controls are external and cannot be verified.
- Guidance: [Secure tool usage](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-best-practice#secure-tool-usage), [MCP best practices](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/model-context-protocol#best-practices)

### TOOL-004 — Minimize outbound tool data and permissions

- Severity: `High`
- Applies when: tools send data outside the model or access downstream resources.
- PASS: only task-required data is sent, credentials are excluded, and tool identities/permissions are least privilege.
- FAIL: credentials are disclosed to a tool or unauthorized destination, clearly unnecessary sensitive data is sent, or broad tool permissions have no supported need.
- REVIEW: outbound data, gateway policy, or downstream authorization cannot be established.
- Rationale: credential recording is reported primarily under `PRIV-001`; do not duplicate the same root cause as two release blockers.
- Guidance: [Secure tool usage](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-best-practice#secure-tool-usage), [Function-calling security](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/function-calling#security-and-data-considerations)

### TOOL-005 — Enforce approval for high-risk tool calls

- Severity: `High`
- Applies when: a tool can perform high-impact, write, destructive, irreversible, or similarly consequential operations.
- PASS: runtime, gateway, policy, or another enforceable control pauses, rejects, or authorizes the exact call with risk-appropriate review of tool name and arguments; equivalent non-human controls are acceptable when justified by the impact assessment.
- FAIL: a high-risk call is automatically approved without equivalent documented controls, or prompt text is presented as the only approval enforcement.
- REVIEW: approval or equivalent controls are external and cannot be verified.
- N/A: tools are read-only and no consequential operation is identified.
- Guidance: [MCP best practices](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/model-context-protocol#best-practices), [Enforce tool approval](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/use-toolbox-hosted-agent#enforce-tool-approval)

### RAI-001 — Match guardrails and human oversight to impact

- Severity: `High`
- Applies when: production use or actions can materially affect people, rights, finances, sensitive data, systems, or irreversible state.
- PASS: a documented impact assessment maps risk-proportionate controls to applicable input, tool-call, tool-response, and output risks, including authorization, intervention, override, and remediation where needed.
- FAIL: high-impact autonomous actions are explicitly enabled with neither effective authorization/override nor documented safety controls.
- REVIEW: business impact, inherited/default policy, supported intervention points, or externally implemented oversight is not visible.
- N/A: no material safety impact or consequential action is identified.
- Expected state: absence of a custom guardrail alone is not a failure. Human approval is one strong option for high-risk actions, not the only valid control; independent policy enforcement, transaction limits, circuit breakers, and equivalent controls can satisfy the assessed risk.
- Guidance: [Foundry Guardrails](https://learn.microsoft.com/azure/foundry/guardrails/guardrails-overview), [Foundry Agent transparency](https://learn.microsoft.com/azure/foundry/responsible-ai/agents/transparency-note#evaluating-and-integrating-agent-service-for-your-use), [Responsible AI in Azure workloads](https://learn.microsoft.com/azure/well-architected/ai/responsible-ai#implement-agentic-ai-safeguards)

## Observability, privacy, and evaluation

### OBS-001 — Ensure production agent operations are observable

- Severity: `High`
- Applies when: the `production-readiness` profile is selected and production use is claimed or planned.
- PASS: Foundry server-side tracing is connected to Application Insights, supported automatic hosting/framework instrumentation exports to its configured backend, or explicit instrumentation exports applicable agent, model, and tool telemetry.
- FAIL: production explicitly disables all applicable tracing/monitoring without a documented alternative, or claims tracing is enabled while required configuration is missing or contradictory.
- REVIEW: project connections, server-side tracing, or production telemetry configuration are remote and cannot be established.
- N/A: the `template-baseline` profile is selected and the target explicitly delegates production observability to adopters.
- Expected state: explicit application OpenTelemetry code is not mandatory when supported server-side or automatic instrumentation is used.
- Guidance: [Set up tracing](https://learn.microsoft.com/azure/foundry/observability/how-to/trace-agent-setup), [Agent tracing overview](https://learn.microsoft.com/azure/foundry/observability/concepts/trace-agent-concept)

### OBS-002 — Protect and govern production telemetry content

- Severity: `High`
- Applies when: production logs, traces, telemetry, exceptions, or diagnostics can contain personal data, sensitive data, or agent message/tool content.
- PASS: collection uses minimum necessary fields; message/tool content capture is disabled unless justified; necessary sensitive content is minimized, redacted, or protected with least-privilege access, retention, and applicable user notice.
- FAIL: raw personal or sensitive production content is recorded without documented purpose and applicable minimization, access, and retention controls.
- REVIEW: capture settings, processors, sampling, RBAC, retention, or remotely managed middleware cannot be established.
- N/A: no applicable production telemetry/content collection exists.
- Expected state: necessary content capture can be valid when justified and governed. Hashing alone does not prove adequate protection. Report captured credentials primarily under `PRIV-001`, not twice as independent blockers.
- Guidance: [Tracing security and privacy](https://learn.microsoft.com/azure/foundry/observability/how-to/trace-agent-setup#security-and-privacy), [Tracing data handling](https://learn.microsoft.com/azure/foundry/observability/concepts/trace-data#privacy), [Configure retention](https://learn.microsoft.com/azure/azure-monitor/logs/data-retention-configure)

### PRIV-001 — Never record secrets or authorization material

- Severity: `Critical`
- Applies when: code, hosting middleware, tools, telemetry, or tracing can record inputs, outputs, request metadata, or credentials.
- PASS: all inspectable recording paths exclude or redact credentials, tokens, authorization headers, credential-bearing connection strings, and secret values; remotely managed capture policy is known when production tracing is enabled.
- FAIL: repository evidence records or enables recording of secret or authorization values under any logging level.
- REVIEW: downstream processors, server-side tracing content policy, or remotely managed middleware can record data but cannot be inspected.
- Expected state: a model API option such as `store=false` does not by itself prove that logs, middleware, or tracing exclude authorization material.
- Guidance: [Tracing security and privacy](https://learn.microsoft.com/azure/foundry/observability/how-to/trace-agent-setup#security-and-privacy), [Tool best practices](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-best-practice#secure-tool-usage)

### EVAL-001 — Evaluate and gate production agent changes

- Severity: `High`
- Applies when: the `production-readiness` profile is selected and an initial production publication or meaningful behavior change affects instructions, model, tools, orchestration, data, or safety behavior.
- PASS: a reproducible evaluation uses representative and edge-case data, relevant system/process evaluators or deterministic/manual alternatives, documented acceptance criteria, and an exact immutable candidate version; promotion blocks on a passing result or an auditable approval attesting to that result.
- FAIL: evaluation configuration is empty or targets the wrong version; a required evaluation failed but promotion proceeds; a declared gate is bypassed or is actually nonblocking; or relevant behavior is knowingly omitted without justification.
- REVIEW: evaluation assets, remote suites, release process, approvals, or candidate-version binding cannot be established.
- N/A: the `template-baseline` profile is selected, or no production publication/behavior change is in scope.
- Expected state: Foundry evaluation services and CI integrations are optional implementation choices. Repository checks, manual recorded evaluation, third-party frameworks, and organization change-management gates can be valid. Pin datasets, evaluators/rubrics, models, and agent versions when results must be comparable.
- Guidance: [Agent development lifecycle](https://learn.microsoft.com/azure/foundry/agents/concepts/development-lifecycle#core-capabilities-for-the-agent-development-lifecycle), [Evaluate agents](https://learn.microsoft.com/azure/foundry/observability/how-to/evaluate-agent), [Agent evaluators](https://learn.microsoft.com/azure/foundry/concepts/evaluation-evaluators/agent-evaluators)

## Infrastructure and lifecycle

### NET-001 — Implement the selected network-isolation model consistently

- Severity: `Advisory`
- Applies when: customer policy, data-risk assessment, or repository architecture selects an inbound or egress isolation model.
- PASS: the selected public, private-endpoint, BYO-VNet, or managed-VNet model is appropriate to the stated risk and is represented consistently across applicable dependencies.
- FAIL: the repository explicitly claims private-only operation while enabling public access or omitting a required dependency path.
- REVIEW: an isolation requirement exists, but the intended model or deployed network/DNS state cannot be established.
- N/A: no customer, regulatory, data-classification, inbound-isolation, or egress-isolation requirement is present.
- Advisory behavior: private networking is not mandatory for every Foundry Agent. Once a project selects or promises private-only behavior, contradiction of that model is a failing security defect.
- Expected state: required endpoints, DNS, subnets, routes, and public-access settings vary by topology; managed-VNet designs need not show a customer-managed agent subnet.
- Guidance: [Foundry networking options](https://learn.microsoft.com/azure/foundry/agents/concepts/networking-options), [Configure private link](https://learn.microsoft.com/azure/foundry/how-to/configure-private-link)

### LIFE-001 — Use stable logical agent references and intentional versioning

- Severity: `Medium`
- Applies when: code or automation creates or deploys agents.
- PASS: prompt-agent runtime code reuses a persisted reference or stable get-or-create behavior; Hosted Agent lifecycle automation reuses the logical agent name and creates immutable versions only during intentional lifecycle operations, never ordinary request handling.
- FAIL: application startup or request handling unconditionally creates a new logical agent/resource.
- REVIEW: lifecycle is managed remotely and not represented locally.
- Expected state: this rule concerns logical agent resources and versions, not Microsoft Entra agent identity. Intentional Hosted Agent deployment creates immutable versions and is valid.
- Guidance: [Agent development lifecycle](https://learn.microsoft.com/azure/foundry/agents/concepts/development-lifecycle#core-capabilities-for-the-agent-development-lifecycle), [Hosted-agent versioning](https://learn.microsoft.com/azure/foundry/agents/concepts/hosted-agents#platform-details)

### A365-001 — Consider Agent 365 for applicable enterprise integration

- Severity: `Advisory`
- Applies when: Microsoft 365 integration, Work IQ, Activity notifications, enterprise agent identity, or cross-agent enterprise governance is intended.
- PASS: Agent 365 capabilities or built-in Foundry integration are used where applicable, or an alternative is reasonable for the requirements.
- FAIL: never under the default advisory.
- REVIEW: never under the default advisory.
- N/A: no applicable Agent 365 scenario is found.
- Advisory behavior: do not require the Agent 365 SDK when Foundry's built-in integration supplies the needed capability. An organization rule may make Agent 365 mandatory.
- Guidance: [Agent 365 SDK](https://learn.microsoft.com/microsoft-agent-365/developer/agent-365-sdk), [Agent 365 integration with Foundry](https://learn.microsoft.com/azure/foundry/agents/concepts/agent-365-integration)

### CFG-004 — Do not override platform-managed runtime configuration

- Severity: `Medium`
- Applies when: Hosted Agent runtime or deployment configuration is present.
- PASS: reserved `FOUNDRY_*` and `AGENT_*` values are consumed but not redefined or overwritten; production credentials and endpoints have no unsafe literal fallback.
- FAIL: code or deployment configuration explicitly overrides reserved variables, local configuration demonstrably shadows a hosted value, or a credential/production endpoint falls back to an unsafe literal.
- REVIEW: configuration precedence can plausibly alter platform-managed values but cannot be determined.
- Expected state: general required-setting validation and startup correctness belong to deployability checks, not this rule.
- Guidance: [Hosted-agent environment variables](https://learn.microsoft.com/azure/foundry/agents/how-to/configure-hosted-agent-env-variables#review-platform-environment-variables)
