## Subtypes (kind)

The `kind` property is a required string that determines the specific Cognitive Service. Verified values from CAF resource abbreviations:

| Kind | Service Name | CAF Prefix |
|------|--------------|------------|
| `AIServices` | Azure AI Foundry (multi-service) | `aif` |
| `CognitiveServices` | Foundry Tools multi-service account | `ais` |
| `OpenAI` | Azure OpenAI Service | `oai` |
| `ComputerVision` | Computer Vision | `cv` |
| `ContentModerator` | Content Moderator | `cm` |
| `ContentSafety` | Content Safety | `cs` |
| `CustomVision.Prediction` | Custom Vision — Prediction | `cstv` |
| `CustomVision.Training` | Custom Vision — Training | `cstvt` |
| `FormRecognizer` | Document Intelligence | `di` |
| `Face` | Face API | `face` |
| `HealthInsights` | Health Insights | `hi` |
| `ImmersiveReader` | Immersive Reader | `ir` |
| `TextAnalytics` | Language Service | `lang` |
| `SpeechServices` | Speech Service | `spch` |
| `TextTranslation` | Translator | `trsl` |

> **Note:** The `kind` value is set at creation and **cannot be changed**. The `kind` determines which SKUs, endpoints, and features are available.
