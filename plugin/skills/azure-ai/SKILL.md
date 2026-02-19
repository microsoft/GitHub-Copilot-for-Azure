---
name: azure-ai
description: |
  Use for Azure AI: Search, Speech, Document Intelligence. Helps with search, vector/hybrid search, speech-to-text, text-to-speech, transcription, OCR.
  USE FOR: AI Search, query search, vector search, hybrid search, semantic search, speech-to-text, text-to-speech, transcribe, OCR, convert text to speech.
  DO NOT USE FOR: Function apps/Functions (use azure-functions), databases (azure-postgres/azure-kusto), resources, deploy model (use microsoft-foundry), model deployment (use microsoft-foundry), Foundry project (use microsoft-foundry), AI Foundry (use microsoft-foundry), quota management (use microsoft-foundry), create agent (use microsoft-foundry), RBAC for Foundry (use microsoft-foundry), GPT deployment (use microsoft-foundry).
---

# Azure AI Services

## Services

| Service | Use When | MCP Tools | CLI |
|---------|----------|-----------|-----|
| AI Search | Full-text, vector, hybrid search | `azure__search` | `az search` |
| Speech | Speech-to-text, text-to-speech | `azure__speech` | - |
| Document Intelligence | Form extraction, OCR | - | - |

> ⚠️ **Note:** For Foundry (AI models, agents, deployments, quota) and OpenAI (GPT models, embeddings), use the **microsoft-foundry** skill instead.

## MCP Server (Preferred)

When Azure MCP is enabled:

### AI Search
- `azure__search` with command `search_index_list` - List search indexes
- `azure__search` with command `search_index_get` - Get index details
- `azure__search` with command `search_query` - Query search index

### Speech
- `azure__speech` with command `speech_transcribe` - Speech to text
- `azure__speech` with command `speech_synthesize` - Text to speech

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.

## AI Search Capabilities

| Feature | Description |
|---------|-------------|
| Full-text search | Linguistic analysis, stemming |
| Vector search | Semantic similarity with embeddings |
| Hybrid search | Combined keyword + vector |
| AI enrichment | Entity extraction, OCR, sentiment |

## Speech Capabilities

| Feature | Description |
|---------|-------------|
| Speech-to-text | Real-time and batch transcription |
| Text-to-speech | Neural voices, SSML support |
| Speaker diarization | Identify who spoke when |
| Custom models | Domain-specific vocabulary |

## Service Details

For deep documentation on specific services:

- AI Search indexing and queries -> [Azure AI Search documentation](https://learn.microsoft.com/azure/search/search-what-is-azure-search)
- Speech transcription patterns -> [Azure AI Speech documentation](https://learn.microsoft.com/azure/ai-services/speech-service/overview)
- Foundry agents, models, and deployments -> Use the **microsoft-foundry** skill
