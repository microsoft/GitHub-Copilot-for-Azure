# AI Workload Security — Azure AI/ML IaC

Services are increasingly built *with* AI on rapid release cycles, and static rules go stale
fast. For AI resource types, treat this file as SEED HINTS and **ground live** via
`microsoft_docs_search` / `bicepschema_get` before emitting a finding — the authoritative
control/property/default comes from current Microsoft Learn, not this table.

## In-scope AI/ML resource types
| Resource type | Notes |
|---|---|
| `Microsoft.CognitiveServices/accounts` | Azure OpenAI, Azure AI Services / multi-service (`kind` = `OpenAI`, `AIServices`, etc.) |
| `Microsoft.CognitiveServices/accounts/deployments` | Model deployments; check RAI/content-filter policy |
| `Microsoft.MachineLearningServices/workspaces` | Azure ML / AI Foundry hub & project |
| `Microsoft.MachineLearningServices/workspaces/onlineEndpoints` | Inference endpoints |
| `Microsoft.Search/searchServices` | AI Search (RAG/grounding index over sensitive data) |

## Seed control checks (reconcile against live Learn before emitting)
| Property / condition | Insecure value | MCSB seed | Why it matters for AI |
|---|---|---|---|
| `properties.publicNetworkAccess` | `Enabled` | NS-2 | Model/inference endpoint reachable from internet; use private endpoint |
| `properties.networkAcls.defaultAction` | `Allow` | NS-2 | No IP/VNet allowlist on the AI data plane |
| `properties.disableLocalAuth` | `false` | IM-1 | API-key auth instead of Entra ID → key theft = full model access |
| `properties.encryption` (missing/`Microsoft.CognitiveServices`) | not CMK | DP-5 | Prompts, fine-tune data, embeddings not CMK-encrypted |
| deployment `raiPolicyName` / content filter | absent | AI-SAFETY | No abuse/jailbreak/harmful-content filtering on the model deployment |
| ML `hbiWorkspace` | `false` (sensitive data) | AI-SAFETY (confirm live) | High-business-impact flag off for sensitive training data |
| ML associated storage/keyvault `publicNetworkAccess` | `Enabled` | NS-2 | Training data / secrets exposed via linked resources |
| AI Search `disableLocalAuth` / `authOptions` apiKey | key auth | IM-1 | Grounding index (often RAG over sensitive corp data) key-accessible |
| managed identity `identity.type` | absent | IM-3 | Service can't pull models/data via workload identity; falls back to keys |

## AI threat-framework mapping (attack-path / AI-risk mode)

### MITRE ATLAS (adversarial ML — parallels ATT&CK for AI systems)
| IaC misconfig | ATLAS technique | Tactic |
|---|---|---|
| Public/keyed model endpoint (NS-2, IM-1) | AML.T0040 ML Model Inference API Access | ML Model Access |
| No content/RAI filter on deployment | AML.T0051 LLM Prompt Injection | Initial Access / Execution |
| Unrestricted inference endpoint | AML.T0024 Exfiltration via ML Inference API | Exfiltration |
| Public training data / linked storage (NS-2, DP-4) | AML.T0020 Poison Training Data | Resource Development / Persistence |
| Model artifact readable/writable | AML.T0010 ML Supply Chain Compromise | Initial Access |
| Keyed/over-permissive endpoint | AML.T0044 Full ML Model Access | ML Model Access |

### OWASP Top 10 for LLM Applications (2025)
| IaC misconfig | OWASP LLM risk |
|---|---|
| No content/RAI filter, no input validation surface | LLM01 Prompt Injection |
| Overly broad model/data output exposure | LLM02 Sensitive Information Disclosure |
| Public training data / linked storage writable | LLM04 Data and Model Poisoning |
| Managed identity absent → keys / broad grants | LLM06 Excessive Agency |
| CMK/encryption off, model artifact exposed | LLM03 Supply Chain / LLM10 Unbounded Consumption |
| Public unauthenticated inference endpoint | LLM10 Unbounded Consumption (cost/DoS) |

## Reporting
Emit AI findings in the same JSON schema. Set `control_id` to the reconciled MCSB control (or
`AI-SAFETY` for RAI/content-filter gaps). In attack-path/AI-risk mode add `atlas` and
`owasp_llm` fields alongside `mitre_attack`. Always ground the resource's current secure
defaults via `microsoft_docs_search` before flagging a missing property.
