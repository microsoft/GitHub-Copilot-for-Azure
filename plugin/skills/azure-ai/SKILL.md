---
name: azure-ai
description: Azure AI Services including AI Search, Speech, Foundry, OpenAI, and Document Intelligence. Provides capabilities for full-text/vector/hybrid search, speech-to-text, text-to-speech, AI models, agents, and prompt flows.
---

# Azure AI Services

## Services

| Service | Use When | MCP Tools | CLI |
|---------|----------|-----------|-----|
| AI Search | Full-text, vector, hybrid search | `azure_search_*` | `az search` |
| Speech | Speech-to-text, text-to-speech | `azure_speech_*` | - |
| Foundry | AI models, agents, prompt flows | `azure_foundry_*` | `az ml` |
| OpenAI | GPT models, embeddings, DALL-E | - | `az cognitiveservices` |
| Document Intelligence | Form extraction, OCR | - | - |

## MCP Server (Preferred)

When Azure MCP is enabled:

### AI Search
- `azure_search_index_list` - List search indexes
- `azure_search_index_get` - Get index details
- `azure_search_query` - Query search index

### Speech
- `azure_speech_transcribe` - Speech to text
- `azure_speech_synthesize` - Text to speech

### Foundry
- `azure_foundry_model_list` - List AI models
- `azure_foundry_deployment_list` - List deployments
- `azure_foundry_agent_list` - List AI agents

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

## Foundry Capabilities

| Feature | Description |
|---------|-------------|
| Model catalog | GPT-4, Llama, Mistral, custom |
| AI agents | Multi-turn, tool calling, RAG |
| Prompt flow | Orchestration, evaluation |
| Fine-tuning | Custom model training |

## Service Details

For deep documentation on specific services:

- AI Search indexing and queries -> [Azure AI Search documentation](https://learn.microsoft.com/azure/search/search-what-is-azure-search)
- Speech transcription patterns -> [Azure AI Speech documentation](https://learn.microsoft.com/azure/ai-services/speech-service/overview)
- Foundry agents and flows -> [Azure AI Foundry documentation](https://learn.microsoft.com/azure/ai-studio/what-is-ai-studio)
